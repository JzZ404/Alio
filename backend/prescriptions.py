import io
import json
import os
import re

import pdfplumber
from google import genai
from supabase import create_client, Client

PATIENT_ID = "aaron"

SIMULATED_EPIC_MEDS = [
    {
        "name": "Lisinopril",
        "dosage": "10mg once daily",
        "instructions": "Take in the morning. Avoid potassium supplements.",
        "side_effects": ["dizziness", "dry cough", "elevated potassium"],
    },
    {
        "name": "Metformin",
        "dosage": "500mg twice daily",
        "instructions": "Take with meals to reduce stomach upset.",
        "side_effects": ["nausea", "diarrhea", "stomach upset"],
    },
    {
        "name": "Atorvastatin",
        "dosage": "20mg at bedtime",
        "instructions": "Take at the same time each night.",
        "side_effects": ["muscle pain", "liver enzyme changes", "headache"],
    },
]

_EXTRACTION_PROMPT = """\
Extract all medications from the following prescription text.

Return ONLY a JSON array with no extra text. Each object must have exactly these fields:
- "name": medication name (string)
- "dosage": dose and frequency (string)
- "instructions": how to take it (string)
- "side_effects": list of side effects (array of strings)

If a field is not mentioned, use an empty string or empty array.

Prescription text:
{text}"""

_supabase_client: Client | None = None


def _get_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
        )
    return _supabase_client


def parse_prescription(pdf_bytes: bytes) -> list[dict]:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)

    if not text.strip():
        raise ValueError("Could not extract text from PDF")

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = client.models.generate_content(
        model="models/gemma-4-31b-it",
        contents=_EXTRACTION_PROMPT.format(text=text),
    )

    raw = response.text.strip()
    # Use non-greedy regex with bracket counting to handle nested structures
    start = raw.find('[')
    if start == -1:
        raise ValueError(f"Could not parse medications from model response: {raw}")

    bracket_count = 0
    for i in range(start, len(raw)):
        if raw[i] == '[':
            bracket_count += 1
        elif raw[i] == ']':
            bracket_count -= 1
            if bracket_count == 0:
                return json.loads(raw[start:i+1])

    raise ValueError(f"Could not parse medications from model response: {raw}")


def save_prescription(medications: list[dict], source: str) -> dict:
    result = (
        _get_client()
        .table("prescriptions")
        .insert({"patient_id": PATIENT_ID, "source": source, "medications": medications})
        .execute()
    )
    if not result.data:
        raise ValueError("Supabase insert returned no data — check RLS policies and table schema")
    return result.data[0]


def list_prescriptions() -> list[dict]:
    result = (
        _get_client()
        .table("prescriptions")
        .select("*")
        .eq("patient_id", PATIENT_ID)
        .order("uploaded_at", desc=True)
        .execute()
    )
    return result.data
