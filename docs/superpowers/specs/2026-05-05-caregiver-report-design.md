# Caregiver Daily Report Feature — Design Spec
**Date:** 2026-05-05
**Project:** Elderly Health Assistant (Hackathon)
**Scope:** Backend + Streamlit demo UI

---

## Overview

Add a caregiver report workflow to the existing health assistant. A caregiver submits a daily health check via voice recording and/or typed notes. Gemma 4 transcribes the audio, merges it with typed notes, and produces a plain-language summary with structured highlights. A family member reads the summary on a separate Streamlit page.

---

## Architecture

```
Caregiver (Streamlit — pages/caregiver.py)
  ├── Voice recording (st.audio_input → WAV bytes)
  │     └── speech_recognition (Google free STT) → transcript text
  └── Typed notes (st.text_area)
                    │
                    ▼
             Combined text prompt
                    │
                    ▼
              Gemma 4 API
              (text-only call: transcript + notes)
                    │
                    ▼
           report_YYYY-MM-DD.json
           { summary, mood, medications_noted,
             urgent, transcript, timestamp }
                    │
                    ▼
       Family (Streamlit — pages/family.py)
       Read-only view, auto-refreshes every 30s
```

- `gemma-4-31b-it` is text-only — voice is transcribed first using the `speech_recognition` Python library (Google's free speech-to-text), then the transcript is passed as text to Gemma 4
- Two Streamlit pages inside one app (`app.py` with `pages/` directory)
- Reports saved as JSON files: `report_YYYY-MM-DD.json`, one per day
- Follows existing file-per-day pattern used by `med_log_YYYY-MM-DD.txt`
- No database required

---

## Caregiver Page (`pages/caregiver.py`)

**Inputs:**
- `st.audio_input()` — records voice from phone/device microphone, returns WAV bytes
- `st.text_area()` — optional typed notes

**Behavior:**
- Submit button enabled only when at least one input is provided
- On submit: calls Gemma 4 with both inputs, saves JSON response, shows confirmation
- Confirmation message: "Report submitted."
- Overwrites today's report if submitted more than once (last write wins)

---

## Gemma 4 Prompt

**Model:** `gemma-4-31b-it` (same as existing assistant)

**System prompt:**
```
You are a medical report summarizer for a family member with no medical background.

You will receive a caregiver's daily health report for {patient_name}. It may include
a voice recording, typed notes, or both. The notes may contain medical terminology.

Your job:
1. Transcribe any audio provided (if present)
2. Combine with any typed notes
3. Write a SHORT plain-language summary (3-5 sentences) a non-medical family member
   can easily understand — no jargon
4. Extract 3 highlights

Reply in this exact JSON format:
{
  "summary": "...",
  "mood": "...",
  "medications_noted": ["...", "..."],
  "urgent": false
}
```

**Request:** Single text message containing the transcript (if voice was recorded) + typed notes. Both are merged into one string before the API call.

**Response:** Parsed as JSON and saved to `report_YYYY-MM-DD.json` with an added `timestamp` field.

---

## Report File Format (`report_YYYY-MM-DD.json`)

```json
{
  "timestamp": "2026-05-05T14:32:00",
  "summary": "Aaron had a calm day. He took his morning medications with breakfast...",
  "mood": "calm",
  "medications_noted": ["Lisinopril", "Vitamin D"],
  "urgent": false
}
```

---

## Family Page (`pages/family.py`)

**Display:**
- Red banner if `urgent: true`: "Urgent: Please contact the caregiver"
- Plain-language summary (large, readable text)
- 3 highlight cards: Mood | Medications Mentioned | Urgent Status
- Timestamp of submission
- Dropdown to view previous days' reports (scans for `report_*.json` files)

**Behavior:**
- Read-only, no inputs
- Auto-refreshes every 30 seconds via `st.rerun()`
- Shows "No report submitted today yet" if today's file does not exist

---

## File Structure

```
Gemma/
├── app.py                        # Streamlit entry point
├── pages/
│   ├── caregiver.py              # Caregiver submit page
│   └── family.py                 # Family view page
├── report.py                     # Transcription + Gemma 4 call + JSON save logic
├── my_info.json                  # Patient info (existing)
├── assistant.py                  # Existing elderly chatbot (unchanged)
├── report_YYYY-MM-DD.json        # Daily reports (generated)
└── med_log_YYYY-MM-DD.txt        # Existing med logs (unchanged)
```

---

## Constraints

- Gemma 4 only (`gemma-4-31b-it`) — no other AI models
- Voice transcription uses `speech_recognition` library (Google free STT) — not an AI model, just a utility
- Hackathon scope — no auth, no database, no notifications
- Android mobile browser is primary target for Streamlit UI
- Existing `assistant.py` is not modified
