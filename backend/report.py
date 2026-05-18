import io
import json
import os
import re
from datetime import date, datetime

import speech_recognition as sr
from google import genai
from google.genai import types

from medical_ai import retry_transient

_REPORT_PREFIX = "report_"
_SYSTEM_PROMPT = """\
You are a clinical-reasoning assistant turning ONE caregiver voice note for
{patient_name} into a short structured summary the family can read at a glance.
You MUST return JSON that matches the schema exactly. Do not include prose
outside the JSON object.

Rules:
- "summary": 2-3 plain-language sentences. No medical jargon. Only what the
  caregiver actually said.
- "mood": one short phrase (e.g. "In pain", "Cheerful", "Tired"). Empty string
  if not mentioned.
- "medications_noted": list of medication names the caregiver mentioned (taken
  OR missed). Empty list if none mentioned.
- "urgent": true ONLY if there's a critical concern (BP > 160/100, severe pain,
  missed critical med, fall, chest pain, stroke signs).

SCHEMA (return EXACTLY this shape):
{{
  "summary": string,
  "mood": string,
  "medications_noted": [string],
  "urgent": boolean
}}

EXAMPLE input:
Voice transcript: Morning check at 9:15. BP 142 over 88, pulse 76. She slept
poorly but mood is fine. Took Lisinopril and Metformin. Out of Vitamin D.

EXAMPLE output:
{{
  "summary": "Morning check at 9:15. Blood pressure 142/88, pulse 76. Slept poorly but mood is fine. Took her morning Lisinopril and Metformin. Out of Vitamin D.",
  "mood": "Fine",
  "medications_noted": ["Lisinopril", "Metformin", "Vitamin D"],
  "urgent": false
}}"""


def _report_path(date_str: str) -> str:
    return f"{_REPORT_PREFIX}{date_str}.json"


def save_report(data: dict) -> None:
    record = {**data, "timestamp": datetime.now().isoformat(timespec="seconds")}
    with open(_report_path(date.today().isoformat()), "w") as f:
        json.dump(record, f, indent=2)


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


def transcribe_audio(wav_bytes: bytes) -> str:
    recognizer = sr.Recognizer()
    with sr.AudioFile(io.BytesIO(wav_bytes)) as source:
        audio = recognizer.record(source)
    return recognizer.recognize_google(audio)


_SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "mood": {"type": "string"},
        "medications_noted": {"type": "array", "items": {"type": "string"}},
        "urgent": {"type": "boolean"},
    },
    "required": ["summary", "mood", "medications_noted", "urgent"],
}


def summarize_report(patient_name: str, transcript: str, notes: str) -> dict:
    if not transcript and not notes:
        raise ValueError("At least one of transcript or notes must be provided.")
    parts = []
    if transcript:
        parts.append(f"Voice transcript: {transcript}")
    if notes:
        parts.append(f"Written notes: {notes}")
    combined = "\n\n".join(parts)

    # Always hit hosted Gemma 31B for summarize regardless of USE_LOCAL_OLLAMA.
    # The fine-tuned E2B is reliable for the structured /compile shape but
    # hallucinates badly on freeform single-note summaries — see WRITEUP §3.2
    # for the tradeoff. /compile (the headline demo) still uses local Ollama.
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = retry_transient(lambda: client.models.generate_content(
        model="models/gemma-4-31b-it",
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_PROMPT.format(patient_name=patient_name),
            response_mime_type="application/json",
        ),
        contents=combined,
    ))
    raw = (response.text or "").strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"Could not parse JSON from model response: {raw}")
    parsed = json.loads(match.group())
    parsed.setdefault("summary", "")
    parsed.setdefault("mood", "")
    parsed.setdefault("medications_noted", [])
    parsed.setdefault("urgent", False)
    return parsed
