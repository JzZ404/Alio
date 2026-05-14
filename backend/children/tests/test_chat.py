import pytest
from unittest.mock import MagicMock, patch


PATIENT_ID = "dorothy-chen"

SAMPLE_INFO = {
    "id": PATIENT_ID,
    "name": "Erin Yeung",
    "medications": [{"name": "Lisinopril", "time": "8:00 AM", "with_food": True}],
    "appointments": [{"doctor": "Dr. Smith", "type": "Cardiology", "date": "2026-05-20", "time": "10:00 AM", "location": "UW Medical"}],
}

SAMPLE_REPORT = {
    "visit_date": "2026-05-14",
    "visit_time": "10:30",
    "report": {
        "vitals": {"bp": "BP 138/85", "pulse": "pulse 72", "temp": "Temp 98.6", "flag": {"severity": "warning", "label": "Slightly elevated", "note": None}},
        "mood": {"value": "Calm", "flag": {"severity": "good", "label": "Good spirits", "note": None}},
        "meds": {"status": "All Taken", "flag": {"severity": "good", "label": "All Taken", "meds": [{"name": "Lisinopril", "taken": True}]}},
    },
}

SAMPLE_LOG = {
    "visit_date": "2026-05-14",
    "created_at": "2026-05-14T09:12:00",
    "transcript": "Dorothy was in good spirits today.",
    "summary": "Good spirits, ate full meal.",
    "mood": "calm",
    "medications_noted": ["Lisinopril"],
    "urgent": False,
}


@pytest.fixture(autouse=True)
def reset_session(monkeypatch):
    import children.chat
    monkeypatch.setattr(children.chat, "_session", None)
    monkeypatch.setattr(children.chat, "_supabase_client", None)
    monkeypatch.setattr(children.chat, "_genai_client", None)


def _mock_supabase(info=SAMPLE_INFO, reports=None, med_logs=None, history=None):
    reports = reports if reports is not None else [SAMPLE_REPORT]
    med_logs = med_logs if med_logs is not None else [SAMPLE_LOG]
    history = history if history is not None else []

    def make_chain(data):
        chain = MagicMock()
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.order.return_value = chain
        chain.single.return_value = chain
        chain.insert.return_value = chain
        chain.execute.return_value = MagicMock(data=data)
        return chain

    sb = MagicMock()
    insert_chain = MagicMock()
    insert_chain.execute.return_value = MagicMock(data=[])

    def table_router(name):
        if name == "patients":
            return make_chain(info)
        if name == "compiled_reports":
            return make_chain(reports)
        if name == "caregiver_logs":
            return make_chain(med_logs)
        if name == "ai_chat_history":
            chain = make_chain(history)
            chain.insert.return_value = insert_chain
            return chain
        return make_chain([])

    sb.table.side_effect = table_router
    return sb


# --- load_chat_history ---

def test_load_chat_history_returns_entries():
    from children.chat import load_chat_history
    history = [{"role": "user", "content": "hello"}, {"role": "model", "content": "hi"}]
    with patch("children.chat._get_supabase", return_value=_mock_supabase(history=history)):
        result = load_chat_history(PATIENT_ID)
    assert result == history


def test_load_chat_history_returns_empty_on_error():
    from children.chat import load_chat_history
    sb = MagicMock()
    sb.table.side_effect = Exception("connection failed")
    with patch("children.chat._get_supabase", return_value=sb):
        result = load_chat_history(PATIENT_ID)
    assert result == []


# --- save_chat_history ---

def test_save_chat_history_inserts_turns():
    from children.chat import save_chat_history
    sb = _mock_supabase()
    with patch("children.chat._get_supabase", return_value=sb):
        save_chat_history(PATIENT_ID, [
            {"role": "user", "content": "hello"},
            {"role": "model", "content": "hi"},
        ])
    calls = [c for c in sb.table.call_args_list if c[0][0] == "ai_chat_history"]
    assert len(calls) >= 1


# --- build_system_prompt ---

def test_build_system_prompt_includes_patient_name():
    from children.chat import build_system_prompt
    result = build_system_prompt(SAMPLE_INFO, [], [])
    assert "Erin Yeung" in result


def test_build_system_prompt_includes_medication():
    from children.chat import build_system_prompt
    result = build_system_prompt(SAMPLE_INFO, [], [])
    assert "Lisinopril" in result


def test_build_system_prompt_includes_report():
    from children.chat import build_system_prompt
    result = build_system_prompt(SAMPLE_INFO, [SAMPLE_REPORT], [])
    assert "2026-05-14" in result
    assert "Calm" in result


def test_build_system_prompt_no_reports_message():
    from children.chat import build_system_prompt
    result = build_system_prompt(SAMPLE_INFO, [], [])
    assert "no reports" in result.lower()


def test_build_system_prompt_includes_caregiver_log():
    from children.chat import build_system_prompt
    result = build_system_prompt(SAMPLE_INFO, [], [SAMPLE_LOG])
    assert "Good spirits" in result


def test_build_system_prompt_omits_log_section_when_empty():
    from children.chat import build_system_prompt
    result = build_system_prompt(SAMPLE_INFO, [], [])
    assert "Caregiver Logs" not in result


def test_build_system_prompt_includes_flag():
    from children.chat import build_system_prompt
    result = build_system_prompt(SAMPLE_INFO, [SAMPLE_REPORT], [])
    assert "Slightly elevated" in result


# --- send_message ---

def _mock_gemma(reply: str):
    fake_response = MagicMock()
    fake_response.text = reply
    mock_chat = MagicMock()
    mock_chat.send_message.return_value = fake_response
    mock_client = MagicMock()
    mock_client.chats.create.return_value = mock_chat
    return mock_client


def test_send_message_returns_model_response():
    from children.chat import send_message
    sb = _mock_supabase()
    gemma = _mock_gemma("Dorothy has been calm and stable.")
    with patch("children.chat._get_supabase", return_value=sb), \
         patch("children.chat.genai.Client", return_value=gemma), \
         patch.dict("os.environ", {"GOOGLE_API_KEY": "fake-key", "SUPABASE_URL": "http://x", "SUPABASE_KEY": "y"}):
        result = send_message(PATIENT_ID, "How is Dorothy?")
    assert result == "Dorothy has been calm and stable."


def test_send_message_saves_new_turns():
    from children.chat import send_message
    sb = _mock_supabase()
    gemma = _mock_gemma("She's doing well.")
    with patch("children.chat._get_supabase", return_value=sb), \
         patch("children.chat.genai.Client", return_value=gemma), \
         patch.dict("os.environ", {"GOOGLE_API_KEY": "fake-key", "SUPABASE_URL": "http://x", "SUPABASE_KEY": "y"}):
        send_message(PATIENT_ID, "Any concerns?")
    insert_calls = [c for c in sb.table.call_args_list if c[0][0] == "ai_chat_history"]
    assert len(insert_calls) >= 1


def test_send_message_passes_history_to_gemma():
    from children.chat import send_message
    existing = [
        {"role": "user", "content": "previous question"},
        {"role": "model", "content": "previous answer"},
    ]
    sb = _mock_supabase(history=existing)
    gemma = _mock_gemma("Still doing well.")
    with patch("children.chat._get_supabase", return_value=sb), \
         patch("children.chat.genai.Client", return_value=gemma), \
         patch.dict("os.environ", {"GOOGLE_API_KEY": "fake-key", "SUPABASE_URL": "http://x", "SUPABASE_KEY": "y"}):
        send_message(PATIENT_ID, "Follow-up?")
    passed_history = gemma.chats.create.call_args.kwargs["history"]
    assert len(passed_history) == 2
