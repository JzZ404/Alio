import io
import json
import os
import re
from datetime import date, datetime

import speech_recognition as sr
from google import genai
from google.genai import types

_REPORT_PREFIX = "report_"
_SYSTEM_PROMPT = """\
You are a medical report summarizer for a family member with no medical background.

You will receive a caregiver's daily health report for {patient_name}. It may include \
a voice transcript, typed notes, or both. The notes may contain medical terminology.

Your job:
Combine all input into a plain-language summary (3-5 sentences) — no jargon.

Reply in this exact JSON format with no extra text:
{{
  "summary": "...",
  "mood": "...",
  "medications_noted": ["..."],
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


def summarize_report(patient_name: str, transcript: str, notes: str) -> dict:
    if not transcript and not notes:
        raise ValueError("At least one of transcript or notes must be provided.")
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
