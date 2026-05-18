# Caregiver Daily Report Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a caregiver report workflow where a caregiver submits voice + text health notes, Gemma 4 summarizes them into plain language, and a family member reads the result in a Streamlit app.

**Architecture:** A `report.py` module handles voice transcription (speech_recognition) and Gemma 4 summarization; two Streamlit pages in `pages/` handle caregiver input and family read view; daily reports are saved as `report_YYYY-MM-DD.json` files alongside existing `med_log_*.txt` files.

**Tech Stack:** Python 3.10+, Streamlit ≥1.29, SpeechRecognition, google-genai (existing)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `requirements.txt` | Create | Pinned dependencies |
| `report.py` | Create | Transcription, Gemma 4 call, JSON save/load/list |
| `app.py` | Create | Streamlit entry point (home page) |
| `pages/1_Caregiver.py` | Create | Caregiver input form (audio + text → submit) |
| `pages/2_Family.py` | Create | Family read-only view with auto-refresh |
| `tests/__init__.py` | Create | Makes tests a package |
| `tests/test_report.py` | Create | Unit tests for report.py |

`assistant.py` and `my_info.json` are **not modified**.

---

### Task 1: Install dependencies

**Files:**
- Create: `requirements.txt`
- Create: `tests/__init__.py`

- [ ] **Step 1: Create requirements.txt**

```
google-genai
streamlit>=1.29.0
SpeechRecognition
```

Note: `pyaudio` is NOT needed — `SpeechRecognition` uses `AudioFile` (bytes-based), not a microphone directly.

- [ ] **Step 2: Install dependencies**

Run: `pip install -r requirements.txt`

Expected: all packages install without error.

- [ ] **Step 3: Verify Streamlit version supports st.audio_input**

Run: `python -c "import streamlit; print(streamlit.__version__)"`

Expected: `1.29.0` or higher. If lower, run `pip install --upgrade streamlit`.

- [ ] **Step 4: Create tests directory**

Run (PowerShell): `New-Item -ItemType Directory tests; New-Item tests\__init__.py`

- [ ] **Step 5: Commit**

```
git add requirements.txt tests/__init__.py
git commit -m "chore: add dependencies for caregiver report feature"
```

---

### Task 2: Implement report file I/O

**Files:**
- Create: `report.py`
- Create: `tests/test_report.py`

- [ ] **Step 1: Write failing tests for save_report, load_report, list_report_dates**

Create `tests/test_report.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_report.py -v`

Expected: `ModuleNotFoundError: No module named 'report'`

- [ ] **Step 3: Implement file I/O in report.py**

Create `report.py`:

```python
import io
import json
import os
import re
from datetime import date, datetime

import speech_recognition as sr
from google import genai
from google.genai import types

_REPORT_PREFIX = "report_"


def _report_path(date_str: str) -> str:
    return f"{_REPORT_PREFIX}{date_str}.json"


def save_report(data: dict) -> None:
    data["timestamp"] = datetime.now().isoformat(timespec="seconds")
    with open(_report_path(date.today().isoformat()), "w") as f:
        json.dump(data, f, indent=2)


def load_report(date_str: str) -> dict | None:
    path = _report_path(date_str)
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def list_report_dates() -> list[str]:
    files = [
        f for f in os.listdir(".")
        if f.startswith(_REPORT_PREFIX) and f.endswith(".json")
    ]
    return sorted([f[len(_REPORT_PREFIX):-5] for f in files], reverse=True)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_report.py -v`

Expected: 5 tests pass (transcribe/summarize tests will be added next).

- [ ] **Step 5: Commit**

```
git add report.py tests/test_report.py
git commit -m "feat: add report file I/O (save, load, list)"
```

---

### Task 3: Implement transcribe_audio

**Files:**
- Modify: `report.py` (add `transcribe_audio` function — imports already in place)
- Modify: `tests/test_report.py` (append one test)

- [ ] **Step 1: Append failing test to tests/test_report.py**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_report.py::test_transcribe_audio_returns_text -v`

Expected: `AttributeError` — `transcribe_audio` not defined.

- [ ] **Step 3: Add transcribe_audio to report.py**

Append to `report.py` (after `list_report_dates`):

```python
def transcribe_audio(wav_bytes: bytes) -> str:
    recognizer = sr.Recognizer()
    with sr.AudioFile(io.BytesIO(wav_bytes)) as source:
        audio = recognizer.record(source)
    return recognizer.recognize_google(audio)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_report.py::test_transcribe_audio_returns_text -v`

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add report.py tests/test_report.py
git commit -m "feat: add voice transcription via speech_recognition"
```

---

### Task 4: Implement summarize_report

**Files:**
- Modify: `report.py` (add `summarize_report` function — imports already in place)
- Modify: `tests/test_report.py` (append two tests)

- [ ] **Step 1: Append failing tests to tests/test_report.py**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_report.py::test_summarize_report_returns_parsed_dict tests/test_report.py::test_summarize_report_handles_markdown_fences -v`

Expected: `AttributeError` — `summarize_report` not defined.

- [ ] **Step 3: Add summarize_report to report.py**

Append to `report.py` (after `transcribe_audio`):

```python
_SYSTEM_PROMPT = """\
You are a medical report summarizer for a family member with no medical background.

You will receive a caregiver's daily health report for {patient_name}. It may include \
a voice transcript, typed notes, or both. The notes may contain medical terminology.

Your job:
1. Combine all input into a plain-language summary (3-5 sentences) — no jargon
2. Extract 3 highlights

Reply in this exact JSON format with no extra text:
{{
  "summary": "...",
  "mood": "...",
  "medications_noted": ["..."],
  "urgent": false
}}"""


def summarize_report(patient_name: str, transcript: str, notes: str) -> dict:
    parts = []
    if transcript:
        parts.append(f"Voice transcript: {transcript}")
    if notes:
        parts.append(f"Written notes: {notes}")
    combined = "\n\n".join(parts)

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = client.models.generate_content(
        model="gemma-4-31b-it",
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT.format(patient_name=patient_name)
        ),
        contents=combined,
    )

    raw = response.text.strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"Could not parse JSON from model response: {raw}")
    return json.loads(match.group())
```

- [ ] **Step 4: Run all tests**

Run: `pytest tests/test_report.py -v`

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```
git add report.py tests/test_report.py
git commit -m "feat: add Gemma 4 summarization for caregiver reports"
```

---

### Task 5: Implement app.py (Streamlit entry point)

**Files:**
- Create: `app.py`
- Create: `pages/` directory

- [ ] **Step 1: Create app.py**

```python
import streamlit as st

st.set_page_config(page_title="Health Assistant", layout="centered")
st.title("Health Assistant")
st.write("Use the sidebar to navigate:")
st.write("- **Caregiver** — Submit daily health report")
st.write("- **Family** — View latest report summary")
```

- [ ] **Step 2: Create pages directory**

Run (PowerShell): `New-Item -ItemType Directory pages`

- [ ] **Step 3: Verify app runs**

Run: `streamlit run app.py`

Expected: browser opens to home page showing navigation text, no errors in terminal. Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```
git add app.py pages/
git commit -m "feat: add Streamlit app entry point"
```

---

### Task 6: Implement caregiver page

**Files:**
- Create: `pages/1_Caregiver.py`

- [ ] **Step 1: Create pages/1_Caregiver.py**

```python
import json
import streamlit as st
from report import transcribe_audio, summarize_report, save_report


def _load_patient_name() -> str:
    with open("my_info.json") as f:
        return json.load(f)["name"]


st.title("Caregiver Report")
patient_name = _load_patient_name()

audio = st.audio_input("Record voice notes")
notes = st.text_area("Written notes (optional)")

can_submit = audio is not None or bool(notes.strip())

if st.button("Submit Report", disabled=not can_submit):
    with st.spinner("Processing report..."):
        transcript = ""
        if audio is not None:
            try:
                transcript = transcribe_audio(audio.read())
            except Exception:
                st.warning("Could not transcribe audio — using written notes only.")
        result = summarize_report(patient_name, transcript, notes.strip())
        save_report(result)
    st.success("Report submitted.")
```

- [ ] **Step 2: Test the caregiver page manually**

Run: `streamlit run app.py`

1. Open on Android browser at `http://<your-local-ip>:8501`
2. Navigate to "Caregiver" in the sidebar
3. Type notes with medical terms: `"Patient presented with hypertension, BP 145/90, administered 10mg Lisinopril"`
4. Click "Submit Report"
5. Verify "Report submitted." confirmation appears
6. Verify `report_<today>.json` is created in the project directory

- [ ] **Step 3: Commit**

```
git add pages/1_Caregiver.py
git commit -m "feat: add caregiver report submission page"
```

---

### Task 7: Implement family page

**Files:**
- Create: `pages/2_Family.py`

- [ ] **Step 1: Create pages/2_Family.py**

```python
import time
from datetime import date

import streamlit as st
from report import list_report_dates, load_report

st.title("Family Report")

dates = list_report_dates()
today = date.today().isoformat()

if not dates:
    st.info("No reports have been submitted yet.")
    time.sleep(30)
    st.rerun()

selected = st.selectbox("Select date", dates, index=0)
report = load_report(selected)

if report is None:
    st.info("No report submitted for this date yet.")
else:
    if report.get("urgent"):
        st.error("Urgent: Please contact the caregiver")

    st.subheader("Summary")
    st.write(report["summary"])

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("Mood", report.get("mood", "—"))
    with col2:
        meds = report.get("medications_noted", [])
        st.metric("Medications", ", ".join(meds) if meds else "None")
    with col3:
        urgent = report.get("urgent", False)
        st.metric("Status", "Urgent" if urgent else "All Good")

    st.caption(f"Submitted: {report.get('timestamp', 'Unknown')}")

time.sleep(30)
st.rerun()
```

- [ ] **Step 2: Test the family page manually**

Run: `streamlit run app.py`

1. Navigate to "Family" in the sidebar
2. Verify today's summary is displayed in plain language
3. Verify 3 metric columns show Mood, Medications, Status
4. Verify date dropdown shows available report dates
5. Test urgent flag: edit `report_<today>.json`, set `"urgent": true`, refresh page — verify red error banner appears

- [ ] **Step 3: Commit**

```
git add pages/2_Family.py
git commit -m "feat: add family report view page with auto-refresh"
```
