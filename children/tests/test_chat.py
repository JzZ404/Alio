import json
import os
import pytest


@pytest.fixture(autouse=True)
def tmp_working_dir(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    import children.chat
    monkeypatch.setattr(children.chat, "_session", None)


def test_load_chat_history_returns_empty_when_missing():
    from children.chat import load_chat_history
    assert load_chat_history() == []


def test_load_chat_history_returns_saved_entries():
    from children.chat import load_chat_history
    data = [{"role": "user", "content": "hello"}, {"role": "model", "content": "hi"}]
    with open("chat_history.json", "w") as f:
        json.dump(data, f)
    assert load_chat_history() == data


def test_load_chat_history_returns_empty_on_malformed_json():
    from children.chat import load_chat_history
    with open("chat_history.json", "w") as f:
        f.write("not json{{{")
    assert load_chat_history() == []


def test_save_chat_history_creates_file():
    from children.chat import save_chat_history
    history = [{"role": "user", "content": "hello"}, {"role": "model", "content": "hi"}]
    save_chat_history(history)
    assert os.path.exists("chat_history.json")
    with open("chat_history.json") as f:
        assert json.load(f) == history


def test_save_chat_history_overwrites_existing():
    from children.chat import save_chat_history
    save_chat_history([{"role": "user", "content": "first"}])
    save_chat_history([{"role": "user", "content": "second"}])
    with open("chat_history.json") as f:
        data = json.load(f)
    assert len(data) == 1
    assert data[0]["content"] == "second"


def test_build_system_prompt_includes_patient_name():
    from children.chat import build_system_prompt
    info = {
        "name": "Aaron",
        "medications": [{"name": "Lisinopril", "time": "8:00 AM", "with_food": True}],
        "appointments": [{"doctor": "Dr. Smith", "type": "Cardiology", "date": "2026-05-10", "time": "10:30 AM", "location": "UW Medical"}],
    }
    result = build_system_prompt(info, reports=[], med_logs=[])
    assert "Aaron" in result


def test_build_system_prompt_includes_medication():
    from children.chat import build_system_prompt
    info = {
        "name": "Aaron",
        "medications": [{"name": "Vitamin D", "time": "9:00 AM", "with_food": False}],
        "appointments": [],
    }
    result = build_system_prompt(info, reports=[], med_logs=[])
    assert "Vitamin D" in result


def test_build_system_prompt_includes_report_summary():
    from children.chat import build_system_prompt
    info = {"name": "Aaron", "medications": [], "appointments": []}
    reports = [{"date": "2026-05-07", "mood": "calm", "medications_noted": ["Lisinopril"], "urgent": False, "summary": "Aaron had a good day."}]
    result = build_system_prompt(info, reports=reports, med_logs=[])
    assert "Aaron had a good day." in result
    assert "2026-05-07" in result


def test_build_system_prompt_no_reports_message():
    from children.chat import build_system_prompt
    info = {"name": "Aaron", "medications": [], "appointments": []}
    result = build_system_prompt(info, reports=[], med_logs=[])
    assert "no reports" in result.lower()


def test_build_system_prompt_includes_med_log():
    from children.chat import build_system_prompt
    info = {"name": "Aaron", "medications": [], "appointments": []}
    result = build_system_prompt(info, reports=[], med_logs=[("2026-05-07", "took Lisinopril at 8am")])
    assert "took Lisinopril at 8am" in result


def test_build_system_prompt_omits_log_section_when_empty():
    from children.chat import build_system_prompt
    info = {"name": "Aaron", "medications": [], "appointments": []}
    result = build_system_prompt(info, reports=[], med_logs=[])
    assert "Medication Logs" not in result


def test_build_system_prompt_sorts_reports_newest_first():
    from children.chat import build_system_prompt
    info = {"name": "Aaron", "medications": [], "appointments": []}
    reports = [
        {"date": "2026-05-01", "mood": "tired", "medications_noted": [], "urgent": False, "summary": "Older day."},
        {"date": "2026-05-07", "mood": "calm", "medications_noted": [], "urgent": False, "summary": "Recent day."},
    ]
    result = build_system_prompt(info, reports=reports, med_logs=[])
    assert result.index("2026-05-07") < result.index("2026-05-01")


def test_send_message_returns_model_response():
    from children.chat import send_message
    from unittest.mock import patch, MagicMock

    fake_response = MagicMock()
    fake_response.text = "Aaron has been calm and stable."

    mock_chat = MagicMock()
    mock_chat.send_message.return_value = fake_response

    mock_client = MagicMock()
    mock_client.chats.create.return_value = mock_chat

    info = {
        "name": "Aaron",
        "medications": [],
        "appointments": [],
    }
    with open("my_info.json", "w") as f:
        json.dump(info, f)

    with patch("children.chat.genai.Client", return_value=mock_client), \
         patch.dict("os.environ", {"GOOGLE_API_KEY": "fake-key"}):
        result = send_message("How is Aaron doing?")

    assert result == "Aaron has been calm and stable."


def test_send_message_saves_history():
    from children.chat import send_message
    from unittest.mock import patch, MagicMock

    fake_response = MagicMock()
    fake_response.text = "He's doing well."

    mock_chat = MagicMock()
    mock_chat.send_message.return_value = fake_response

    mock_client = MagicMock()
    mock_client.chats.create.return_value = mock_chat

    info = {"name": "Aaron", "medications": [], "appointments": []}
    with open("my_info.json", "w") as f:
        json.dump(info, f)

    with patch("children.chat.genai.Client", return_value=mock_client), \
         patch.dict("os.environ", {"GOOGLE_API_KEY": "fake-key"}):
        send_message("How is he?")

    with open("chat_history.json") as f:
        history = json.load(f)

    assert history[-2] == {"role": "user", "content": "How is he?"}
    assert history[-1] == {"role": "model", "content": "He's doing well."}


def test_send_message_loads_existing_history():
    from children.chat import send_message
    from unittest.mock import patch, MagicMock

    fake_response = MagicMock()
    fake_response.text = "Still doing well."

    mock_chat = MagicMock()
    mock_chat.send_message.return_value = fake_response

    mock_client = MagicMock()
    mock_client.chats.create.return_value = mock_chat

    existing = [
        {"role": "user", "content": "previous question"},
        {"role": "model", "content": "previous answer"},
    ]
    with open("chat_history.json", "w") as f:
        json.dump(existing, f)

    info = {"name": "Aaron", "medications": [], "appointments": []}
    with open("my_info.json", "w") as f:
        json.dump(info, f)

    with patch("children.chat.genai.Client", return_value=mock_client), \
         patch.dict("os.environ", {"GOOGLE_API_KEY": "fake-key"}):
        send_message("Follow-up question")

    # Verify history was passed to create()
    passed_history = mock_client.chats.create.call_args.kwargs["history"]
    assert len(passed_history) == 2
