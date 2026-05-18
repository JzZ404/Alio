# Children Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a persistent Gemma 4 chatbot backend in `children/` that lets family members analyze all historical caregiver reports and discuss the elderly patient's condition.

**Architecture:** A single `children/chat.py` module exposes one public function `send_message(user_input) -> str`. It loads all context (reports, patient info, med logs) into a system prompt, rebuilds a multi-turn Gemma chat session from saved history on each call, and persists the conversation to `chat_history.json`.

**Tech Stack:** Python 3.10+, google-genai (existing), SpeechRecognition (existing), pytest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `children/__init__.py` | Create | Makes `children` a package |
| `children/chat.py` | Create | All chatbot logic |
| `children/tests/__init__.py` | Create | Makes tests a package |
| `children/tests/test_chat.py` | Create | Unit tests |
| `chat_history.json` | Generated at runtime | Persisted conversation |

No existing files are modified.

---

### Task 1: Create directory structure

**Files:**
- Create: `children/__init__.py`
- Create: `children/tests/__init__.py`

- [ ] **Step 1: Create the directories and empty init files**

Run:
```bash
mkdir -p children/tests
touch children/__init__.py children/tests/__init__.py
```

- [ ] **Step 2: Verify structure**

Run: `find children -type f`

Expected output:
```
children/__init__.py
children/tests/__init__.py
```

- [ ] **Step 3: Commit**

```bash
git add children/
git commit -m "chore: scaffold children/ package"
```

---

### Task 2: Implement chat history persistence

**Files:**
- Create: `children/chat.py` (initial version)
- Create: `children/tests/test_chat.py` (initial version)

- [ ] **Step 1: Create `children/tests/test_chat.py` with failing tests**

```python
import json
import os
import pytest


@pytest.fixture(autouse=True)
def tmp_working_dir(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)


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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest children/tests/test_chat.py -v`

Expected: `ModuleNotFoundError: No module named 'children.chat'`

- [ ] **Step 3: Create `children/chat.py` with persistence functions**

```python
import json
import os

from google import genai
from google.genai import types

_HISTORY_FILE = "chat_history.json"
_INFO_FILE = "my_info.json"
_REPORT_PREFIX = "report_"
_LOG_PREFIX = "med_log_"


def load_chat_history() -> list[dict]:
    if not os.path.exists(_HISTORY_FILE):
        return []
    try:
        with open(_HISTORY_FILE) as f:
            return json.load(f)
    except (json.JSONDecodeError, ValueError):
        return []


def save_chat_history(history: list[dict]) -> None:
    with open(_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest children/tests/test_chat.py -v`

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add children/chat.py children/tests/test_chat.py
git commit -m "feat: add chat history persistence"
```

---

### Task 3: Implement `build_system_prompt`

**Files:**
- Modify: `children/chat.py` (add function)
- Modify: `children/tests/test_chat.py` (append tests)

- [ ] **Step 1: Append failing tests to `children/tests/test_chat.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest children/tests/test_chat.py::test_build_system_prompt_includes_patient_name -v`

Expected: `ImportError` — `build_system_prompt` not defined.

- [ ] **Step 3: Add `build_system_prompt` to `children/chat.py`**

Append after `save_chat_history`:

```python
def build_system_prompt(info: dict, reports: list[dict], med_logs: list[tuple[str, str]]) -> str:
    name = info["name"]

    meds = "\n".join(
        f"  - {m['name']} at {m['time']}" + (" (with food)" if m.get("with_food") else "")
        for m in info.get("medications", [])
    ) or "  None listed."

    appts = "\n".join(
        f"  - {a['doctor']} ({a['type']}) on {a['date']} at {a['time']}, {a['location']}"
        for a in info.get("appointments", [])
    ) or "  None upcoming."

    if reports:
        report_lines = []
        for r in reports:
            meds_noted = ", ".join(r.get("medications_noted", [])) or "none"
            urgent = "YES" if r.get("urgent") else "no"
            report_lines.append(
                f"{r['date']}: mood={r.get('mood', '—')}, medications={meds_noted}, urgent={urgent}\n"
                f"  Summary: {r.get('summary', '')}"
            )
        reports_section = "\n".join(report_lines)
    else:
        reports_section = "No reports available yet."

    log_section = ""
    if med_logs:
        log_lines = [f"--- {date} ---\n{content}" for date, content in med_logs]
        log_section = "\n\n[Medication Logs]\n" + "\n".join(log_lines)

    return f"""You are an AI assistant helping family members understand {name}'s health.
Speak clearly and avoid medical jargon.
Never diagnose. You may suggest whether to contact a doctor.

[Patient Info]
Medications:
{meds}
Upcoming appointments:
{appts}

[Daily Report History]
{reports_section}{log_section}"""
```

- [ ] **Step 4: Run all tests**

Run: `pytest children/tests/test_chat.py -v`

Expected: all 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add children/chat.py children/tests/test_chat.py
git commit -m "feat: add build_system_prompt"
```

---

### Task 4: Implement `create_chat_session` and `send_message`

**Files:**
- Modify: `children/chat.py` (add two functions)
- Modify: `children/tests/test_chat.py` (append tests)

- [ ] **Step 1: Append failing tests to `children/tests/test_chat.py`**

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest children/tests/test_chat.py::test_send_message_returns_model_response -v`

Expected: `ImportError` — `send_message` not defined.

- [ ] **Step 3: Add `_load_all_context`, `create_chat_session`, and `send_message` to `children/chat.py`**

Append after `build_system_prompt`:

```python
def _load_all_context() -> tuple[dict, list[dict], list[tuple[str, str]]]:
    with open(_INFO_FILE) as f:
        info = json.load(f)

    report_files = sorted(
        [fn for fn in os.listdir(".") if fn.startswith(_REPORT_PREFIX) and fn.endswith(".json")],
        reverse=True,
    )
    reports = []
    for fn in report_files:
        date_str = fn[len(_REPORT_PREFIX):-5]
        with open(fn) as f:
            data = json.load(f)
        data["date"] = date_str
        reports.append(data)

    log_files = sorted(
        [fn for fn in os.listdir(".") if fn.startswith(_LOG_PREFIX) and fn.endswith(".txt")],
        reverse=True,
    )
    med_logs = []
    for fn in log_files:
        date_str = fn[len(_LOG_PREFIX):-4]
        with open(fn) as f:
            content = f.read().strip()
        if content:
            med_logs.append((date_str, content))

    return info, reports, med_logs


def create_chat_session(system_prompt: str, history: list[dict]):
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    content_history = [
        types.Content(role=entry["role"], parts=[types.Part(text=entry["content"])])
        for entry in history
    ]
    return client.chats.create(
        model="gemma-4-31b-it",
        config=types.GenerateContentConfig(system_instruction=system_prompt),
        history=content_history,
    )


def send_message(user_input: str) -> str:
    info, reports, med_logs = _load_all_context()
    system_prompt = build_system_prompt(info, reports, med_logs)
    history = load_chat_history()
    chat = create_chat_session(system_prompt, history)
    response = chat.send_message(user_input)
    history.append({"role": "user", "content": user_input})
    history.append({"role": "model", "content": response.text})
    save_chat_history(history)
    return response.text
```

- [ ] **Step 4: Run all tests**

Run: `pytest children/tests/test_chat.py -v`

Expected: all 14 tests pass.

- [ ] **Step 5: Commit**

```bash
git add children/chat.py children/tests/test_chat.py
git commit -m "feat: add create_chat_session and send_message"
```

---

### Task 5: Verify full integration

**Files:**
- No new files

- [ ] **Step 1: Run the full test suite**

Run: `pytest children/tests/test_chat.py -v`

Expected: all 14 tests pass, no warnings about missing modules.

- [ ] **Step 2: Verify the module is importable from the project root**

Run: `python -c "from children.chat import send_message; print('OK')"`

Expected: `OK`

- [ ] **Step 3: Confirm no existing tests broken**

Run: `pytest tests/ -v`

Expected: all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: children chatbot backend complete"
```
