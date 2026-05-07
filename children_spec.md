# Family Chatbot Feature — Design Spec
**Date:** 2026-05-07
**Project:** Elderly Health Assistant (Hackathon)
**Scope:** Backend only — `children/` module

---

## Overview

Add a Gemma 4-powered chatbot for family members (children) that analyzes all historical caregiver reports and discusses the elderly patient's condition. The chatbot supports both trend analysis ("how has dad been feeling this week?") and specific advice ("should I call the doctor?"). Conversation history persists across sessions.

---

## Architecture

```
children/
├── __init__.py
├── chat.py             — all chatbot backend logic
└── tests/
    └── test_chat.py    — unit tests

chat_history.json       — persisted conversation (root dir, alongside report_*.json)
```

Data flow:
```
my_info.json + report_*.json + med_log_*.txt
        ↓
   build_system_prompt()
        ↓
   create_chat_session(history=[...])   ← chat_history.json
        ↓
   send_message(user_input) → str
        ↓
   save_chat_history()
```

`chat.py` is a standalone module. The frontend calls `from children.chat import send_message`.

---

## Public API

```python
def send_message(user_input: str) -> str:
    """Send a message, get a response, auto-save history."""
```

This is the only function the frontend needs. Internally it:
1. Calls `build_system_prompt()` — loads all reports, `my_info.json`, med logs
2. Calls `load_chat_history()` — reads `chat_history.json` (empty list if missing)
3. Calls `create_chat_session(history)` — rebuilds Gemma chat session with history
4. Sends the message, gets response
5. Calls `save_chat_history()` — appends both turns and writes to disk
6. Returns the response string

---

## System Prompt

`build_system_prompt(info, reports, med_logs)` produces:

```
You are an AI assistant helping family members understand {patient_name}'s health.
Speak clearly and avoid medical jargon.
Never diagnose. You may suggest whether to contact a doctor.

[Patient Info]
Medications: {name} at {time} (with food / without food)
...
Upcoming appointments: {doctor} ({type}) on {date} at {time}, {location}
...

[Daily Report History]
{date}: mood={mood}, medications={medications_noted}, urgent={urgent}
Summary: {summary}
...
(all available reports, sorted newest first)

[Medication Logs]
--- {date} ---
{med_log contents}
...
(all available med logs)

If no reports are available yet, note that and offer to answer general questions.
```

**Model:** `gemma-4-31b-it` — same as the rest of the project. No specialized medical model needed; the use case is family communication and trend analysis, not clinical diagnosis.

---

## Chat History Persistence

**File:** `chat_history.json` (root directory)

**Format:**
```json
[
  {"role": "user", "content": "How has dad been feeling lately?"},
  {"role": "model", "content": "Based on the past reports..."}
]
```

On `load_chat_history()`: reads the file, returns `[]` if missing or malformed.

On `create_chat_session(history)`: converts each entry to `types.Content` with the appropriate role and passes to `client.chats.create(history=[...])`.

On `save_chat_history()`: appends the new user + model turn and writes the full list back to disk.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `my_info.json` missing | Raises `FileNotFoundError` — caller handles |
| No reports yet | System prompt notes "no reports available", chat still works |
| Gemma API failure | Exception propagates — caller handles |
| Malformed `chat_history.json` | Falls back to empty history, overwrites on next save |
| No med logs | Omits the `[Medication Logs]` section from system prompt |

---

## File Map

| File | Action |
|------|--------|
| `children/__init__.py` | Create (empty) |
| `children/chat.py` | Create — `build_system_prompt`, `load_chat_history`, `save_chat_history`, `create_chat_session`, `send_message` |
| `children/tests/__init__.py` | Create (empty) |
| `children/tests/test_chat.py` | Create — unit tests |
| `chat_history.json` | Generated at runtime |

No existing files are modified.

---

## Constraints

- `gemma-4-31b-it` only — no other AI models
- No diagnosis — system prompt explicitly forbids it
- Backend only — no Streamlit UI changes in this spec
- Hackathon scope — no auth, no multi-user support
