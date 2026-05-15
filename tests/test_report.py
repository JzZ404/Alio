import json
import os
import pytest
from datetime import date


@pytest.fixture(autouse=True)
def tmp_working_dir(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)


def test_save_report_creates_file():
    from report import save_report
    save_report({"summary": "ok", "mood": "calm", "medications_noted": [], "urgent": False})
    assert os.path.exists(f"report_{date.today().isoformat()}.json")


def test_save_report_adds_timestamp():
    from report import save_report
    save_report({"summary": "ok", "mood": "calm", "medications_noted": [], "urgent": False})
    with open(f"report_{date.today().isoformat()}.json") as f:
        data = json.load(f)
    assert "timestamp" in data


def test_load_report_returns_data():
    from report import save_report, load_report
    save_report({"summary": "ok", "mood": "calm", "medications_noted": [], "urgent": False})
    result = load_report(date.today().isoformat())
    assert result["summary"] == "ok"


def test_load_report_returns_none_for_missing():
    from report import load_report
    assert load_report("1900-01-01") is None


def test_list_report_dates_returns_sorted_desc():
    from report import list_report_dates
    for d in ["2026-04-01", "2026-05-01"]:
        with open(f"report_{d}.json", "w") as f:
            json.dump({"summary": "x"}, f)
    assert list_report_dates() == ["2026-05-01", "2026-04-01"]


def test_transcribe_audio_returns_text():
    from report import transcribe_audio
    from unittest.mock import patch, MagicMock

    fake_audio_data = MagicMock()
    mock_recognizer = MagicMock()
    mock_recognizer.record.return_value = fake_audio_data
    mock_recognizer.recognize_google.return_value = "patient had a good day"

    mock_audio_file_instance = MagicMock()
    mock_audio_file_instance.__enter__ = MagicMock(return_value=MagicMock())
    mock_audio_file_instance.__exit__ = MagicMock(return_value=False)

    with patch("report.sr.Recognizer", return_value=mock_recognizer), \
         patch("report.sr.AudioFile", return_value=mock_audio_file_instance):
        result = transcribe_audio(b"fake_wav_bytes")

    assert result == "patient had a good day"
    mock_recognizer.recognize_google.assert_called_once_with(fake_audio_data)
    source_mock = mock_audio_file_instance.__enter__.return_value
    mock_recognizer.record.assert_called_once_with(source_mock)


def test_summarize_report_returns_parsed_dict():
    from report import summarize_report
    from unittest.mock import patch, MagicMock

    fake_response = MagicMock()
    fake_response.text = (
        '{"summary": "Aaron had a calm day.", "mood": "calm",'
        ' "medications_noted": ["Lisinopril"], "urgent": false}'
    )
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = fake_response

    with patch("report.genai.Client", return_value=mock_client), \
         patch.dict("os.environ", {"GOOGLE_API_KEY": "fake-key"}):
        result = summarize_report("Aaron", "patient seemed calm", "BP was 120/80")

    assert result["mood"] == "calm"
    assert result["urgent"] is False
    assert "Lisinopril" in result["medications_noted"]
    call_kwargs = mock_client.models.generate_content.call_args.kwargs
    assert "Aaron" in call_kwargs["config"].system_instruction
    assert "patient seemed calm" in call_kwargs["contents"]
    assert "BP was 120/80" in call_kwargs["contents"]


def test_summarize_report_handles_markdown_fences():
    from report import summarize_report
    from unittest.mock import patch, MagicMock

    fake_response = MagicMock()
    fake_response.text = (
        '```json\n{"summary": "ok", "mood": "tired",'
        ' "medications_noted": [], "urgent": false}\n```'
    )
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = fake_response

    with patch("report.genai.Client", return_value=mock_client), \
         patch.dict("os.environ", {"GOOGLE_API_KEY": "fake-key"}):
        result = summarize_report("Aaron", "", "patient was tired")

    assert result["mood"] == "tired"
