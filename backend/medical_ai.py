import json
import os
import re
from datetime import datetime

import requests
from google import genai
from google.genai import types

_MODEL_NAME = "models/gemma-4-31b-it"

# ── Local Ollama dispatch (fine-tuned Gemma 4 E2B) ──
# When USE_LOCAL_OLLAMA=1, all AI calls route through Ollama's /api/generate
# with raw=true and an explicit Gemma 4 chat template. Ollama's own chat
# template handling is broken for Gemma 4's special tokens (May 2026), so we
# build the prompt ourselves.
_USE_LOCAL_OLLAMA = os.environ.get("USE_LOCAL_OLLAMA", "").lower() in ("1", "true", "yes")
_OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "alio-medical")


def _format_gemma4_prompt(system: str, user: str) -> str:
    """Build the Gemma 4 chat template prompt manually (matches the tokens
    the fine-tuned model was trained on)."""
    return (
        f"<|turn>system\n{system}<turn|>\n"
        f"<|turn>user\n{user}<turn|>\n"
        f"<|turn>model\n"
    )


def _call_ollama(system: str, user: str, json_mode: bool = False) -> str:
    """Call the local Ollama server using raw mode + explicit chat template."""
    payload = {
        "model": _OLLAMA_MODEL,
        "prompt": _format_gemma4_prompt(system, user),
        "raw": True,
        "stream": False,
        "options": {
            "temperature": 0.4,
            "num_predict": 512,
            "stop": ["<turn|>"],
        },
    }
    if json_mode:
        payload["format"] = "json"
    r = requests.post(f"{_OLLAMA_URL}/api/generate", json=payload, timeout=180)
    r.raise_for_status()
    return r.json().get("response", "").strip()


def _call_gemma(system: str, user: str, json_mode: bool = False) -> str:
    """Single dispatch point — routes to local Ollama or hosted Google API."""
    if _USE_LOCAL_OLLAMA:
        return _call_ollama(system, user, json_mode=json_mode)
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    config_kwargs = {"system_instruction": system}
    if json_mode:
        config_kwargs["response_mime_type"] = "application/json"
    response = retry_transient(lambda: client.models.generate_content(
        model=_MODEL_NAME,
        config=types.GenerateContentConfig(**config_kwargs),
        contents=user,
    ))
    return (response.text or "").strip()


def active_model_name() -> str:
    return f"ollama:{_OLLAMA_MODEL}" if _USE_LOCAL_OLLAMA else _MODEL_NAME


# ── Lab report interpretation (same system prompt the model was trained on) ──

_LAB_SYSTEM = """\
You are a medical assistant helping a patient or family member understand lab
results. You will receive a list of lab test names, their values, and reference
ranges. Some may be flagged as High or Low.

Your job: write a plain-language explanation (3-5 sentences) of what the
results mean overall. Focus on: what is normal, what is flagged and why it
matters, and whether the family should follow up with a doctor soon.

Do NOT diagnose. Do NOT use jargon. If everything is normal, say so clearly.

Reply in EXACTLY this JSON format with no extra text:
{
  "summary": "...",
  "flags": ["..."],
  "follow_up": "routine" | "soon" | "urgent"
}
flags is a list of the abnormal results in plain language (empty list if none).
follow_up: "routine" = nothing urgent, "soon" = mention at next appointment,
"urgent" = contact doctor today."""


def interpret_lab_text(extracted_text: str) -> dict:
    """Take raw text extracted from a lab report (e.g., pdfplumber output) and
    return a structured JSON interpretation. Routes through _call_gemma so it
    respects USE_LOCAL_OLLAMA."""
    if not extracted_text.strip():
        raise ValueError("Lab report text is empty")
    user_message = f"Lab Results:\n\n{extracted_text.strip()}"
    raw = _call_gemma(system=_LAB_SYSTEM, user=user_message, json_mode=True)
    return _parse_json_response(raw)


# ── Image OCR for lab report photos (snapped on a phone, scanned, etc.) ──
# Uses the hosted Gemma 4 31B for the *vision* step; the medical interpretation
# still runs locally via _call_gemma → Ollama. So PHI for the image OCR DOES go
# to Google's API briefly, but the reasoning stays on-device. For fully offline
# image input, swap this for Tesseract or the local Gemma 4 multimodal projector
# via llama-mtmd-cli.

_VISION_MODEL = os.environ.get("VISION_MODEL", "models/gemma-4-31b-it")

_VISION_EXTRACT_PROMPT = """\
This is a photo or scan of a medical lab report. Extract ALL test results in
a clean plain-text format, one per line, preserving:
  - Test name
  - Value with units
  - Normal/reference range
  - Status flag (High / Low / Normal) if shown

Example output line:
  Sodium: 138 mmol/L  (Normal range: 135-145)  Normal

Output ONLY the extracted results, no commentary, no headers other than the
panel name if visible (e.g. "Comprehensive Metabolic Panel"). If the image
isn't a lab report, output exactly: "NOT_A_LAB_REPORT"."""


def extract_lab_text_from_image(image_bytes: bytes, mime_type: str = "image/png") -> str:
    """OCR a lab-report image using Gemini/Gemma vision. Returns the extracted
    structured text, ready to feed into interpret_lab_text()."""
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = retry_transient(lambda: client.models.generate_content(
        model=_VISION_MODEL,
        contents=[
            _VISION_EXTRACT_PROMPT,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
    ))
    text = (response.text or "").strip()
    if text == "NOT_A_LAB_REPORT" or not text:
        raise ValueError("This image doesn't look like a lab report")
    return text

_HARD_ESCALATION_KEYWORDS = [
    "chest pain",
    "can't breathe",
    "cannot breathe",
    "trouble breathing",
    "slurred speech",
    "one-sided weakness",
    "sudden weakness",
    "sudden numbness",
    "sudden severe headache",
    "severe bleeding",
    "unconscious",
    "loss of consciousness",
]

_ROLE = """\
You are a clinical-reasoning assistant helping triage a patient's symptoms. You are
NOT giving a diagnosis. Your job is to ask focused follow-up questions when the
information is too thin to triage, and to produce a triage urgency level with a
plain-language explanation when you have enough.
"""

_URGENCY_RUBRIC = """\
Urgency levels (use exactly one of these strings):
- "emergency"  — call 911 or go to the ER now
- "today"      — see a doctor or urgent care today
- "this_week"  — schedule a visit this week
- "self_care"  — monitor at home, no visit needed
"""

_HARD_RULES = """\
Hard escalation rules (NON-NEGOTIABLE — these always force urgency="emergency"):
- chest pain
- sudden one-sided weakness or numbness
- slurred speech
- sudden severe headache
- trouble breathing
- severe bleeding
- loss of consciousness
If any of these appear in the conversation, urgency MUST be "emergency".
"""

_TRIAGE_OUTPUT_FORMAT = """\
Reply in EXACTLY one of these two JSON formats with no extra text:

If you need more information:
{"needs_followup": true, "followup_question": "..."}

If you have enough information to triage:
{"needs_followup": false, "urgency": "...", "explanation": "...", "watch_for": ["...", "..."]}

"explanation" must be 2-4 sentences in plain language (no jargon).
"watch_for" must be 2-3 short items.
"""

_EXPLAIN_OUTPUT_FORMAT = """\
Reply in EXACTLY this JSON format with no extra text:
{"urgency": "...", "explanation": "...", "watch_for": ["...", "..."]}

"explanation" must be 2-4 sentences in plain language (no jargon).
"watch_for" must be 2-3 short items.
"""


def _format_profile(profile: dict) -> str:
    name = profile.get("name", "the patient")
    meds = profile.get("medications", [])
    if meds:
        meds_str = "\n".join(f"  - {m['name']} at {m.get('time', 'unspecified')}" for m in meds)
    else:
        meds_str = "  (none on file)"
    return f"Patient name: {name}\nCurrent medications:\n{meds_str}"


def _format_reports(reports: list[dict]) -> str:
    if not reports:
        return "No recent reports."
    lines = []
    for r in reports:
        ts = r.get("timestamp", "unknown time")
        summary = r.get("summary", "")
        mood = r.get("mood", "")
        lines.append(f"- [{ts}] mood={mood}; {summary}")
    return "\n".join(lines)


def _build_system_prompt(profile: dict, reports: list[dict], mode: str) -> str:
    if mode not in ("triage", "explain"):
        raise ValueError(f"mode must be 'triage' or 'explain', got {mode!r}")
    output_format = _TRIAGE_OUTPUT_FORMAT if mode == "triage" else _EXPLAIN_OUTPUT_FORMAT
    return "\n\n".join([
        _ROLE,
        _URGENCY_RUBRIC,
        _HARD_RULES,
        _format_profile(profile),
        "Recent reports:\n" + _format_reports(reports),
        output_format,
    ])


def _parse_json_response(raw: str) -> dict:
    raw = raw.strip()
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"Could not parse JSON from model response: {raw}")
    return json.loads(match.group())


_TRANSIENT_MARKERS = ("INTERNAL", "UNAVAILABLE", "DEADLINE", "503", "500")


def retry_transient(call, attempts: int = 3):
    """Run `call()` and retry on transient Google API errors with exponential
    backoff (1s, 2s, 4s). Re-raises the last exception if attempts are
    exhausted or the error is not transient."""
    import time
    last_err: Exception | None = None
    for attempt in range(attempts):
        try:
            return call()
        except Exception as e:
            last_err = e
            transient = any(s in str(e).upper() for s in _TRANSIENT_MARKERS)
            if not transient or attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)  # 1s, 2s, then would be 4s on the last try
    raise last_err if last_err else RuntimeError("retry_transient failed")


def _apply_escalation_override(result: dict, conversation: list[dict]) -> dict:
    if result.get("needs_followup"):
        return result
    # Only scan user turns; assistant wording must not self-trigger escalation.
    user_text = " ".join(
        m["content"] for m in conversation if m.get("role") == "user"
    ).lower()
    triggered = any(kw in user_text for kw in _HARD_ESCALATION_KEYWORDS)
    if not triggered:
        return result
    safety_note = " Based on what you described, this may be a medical emergency — please call 911 or go to the ER now."
    return {
        **result,
        "urgency": "emergency",
        "explanation": result.get("explanation", "").rstrip() + safety_note,
        "watch_for": ["Call 911 immediately", "Go to the nearest ER"],
    }


def _format_conversation_as_text(conversation: list[dict]) -> str:
    lines = []
    for m in conversation:
        speaker = "User" if m["role"] == "user" else "Assistant"
        lines.append(f"{speaker}: {m['content']}")
    return "\n".join(lines)


def triage_conversation(
    patient_profile: dict,
    recent_reports: list[dict],
    conversation: list[dict],
) -> dict:
    if not conversation:
        raise ValueError("conversation must contain at least one message")
    system_prompt = _build_system_prompt(patient_profile, recent_reports, mode="triage")
    raw = _call_gemma(
        system=system_prompt,
        user=_format_conversation_as_text(conversation),
        json_mode=True,
    )
    parsed = _parse_json_response(raw)
    return _apply_escalation_override(parsed, conversation)


def explain_report_question(
    patient_profile: dict,
    report: dict,
    question: str,
) -> dict:
    if not question.strip():
        raise ValueError("question must not be empty")
    system_prompt = _build_system_prompt(patient_profile, [report], mode="explain")
    user_message = (
        f"Family member's question about today's report:\n{question.strip()}"
    )
    conversation = [{"role": "user", "content": user_message}]
    raw = _call_gemma(system=system_prompt, user=user_message, json_mode=True)
    parsed = _parse_json_response(raw)
    return _apply_escalation_override(parsed, conversation)


def save_symptom_check(
    started_at: str,
    conversation: list[dict],
    result: dict,
) -> str:
    safe_ts = started_at.replace(":", "-")
    path = f"symptom_check_{safe_ts}.json"
    record = {
        "started_at": started_at,
        "ended_at": datetime.now().isoformat(timespec="seconds"),
        "conversation": conversation,
        "result": result,
        "model": _MODEL_NAME,
    }
    with open(path, "w") as f:
        json.dump(record, f, indent=2)
    return path


_COMPILE_LOGS_SYSTEM = """\
You are a clinical-reasoning assistant compiling a caregiver's voice notes from
a single shift into ONE concise report a family member can read in 30 seconds.

Write in plain language. Lead with the overall picture (mood, energy, anything
notable). Then a short list of what happened: medications given, vitals,
meals/fluids, activities. End with anything the family should watch for.

Do NOT invent details. Only summarize what the caregiver actually said.
If the logs disagree, mention the most recent observation.
Use short paragraphs and bullet points where they help readability.
"""


def compile_caregiver_logs(patient_name: str, logs: list[dict]) -> str:
    if not logs:
        return f"No logs recorded for {patient_name} today."

    parts: list[str] = []
    for log in logs:
        time = (log.get("created_at") or "").split("T")[-1][:5]
        transcript = (log.get("transcript") or "").strip()
        summary = (log.get("summary") or "").strip()
        mood = log.get("mood") or ""
        meds = log.get("medications_noted") or []
        urgent = " [URGENT]" if log.get("urgent") else ""
        line = f"- {time}{urgent}: {transcript}"
        if summary and summary != transcript:
            line += f"\n  (summary: {summary}; mood: {mood}; meds: {', '.join(meds) or 'none'})"
        parts.append(line)

    user_message = (
        f"Patient: {patient_name}\n"
        f"Shift logs (oldest first):\n" + "\n".join(parts) +
        "\n\nWrite the compiled shift report."
    )

    return _call_gemma(system=_COMPILE_LOGS_SYSTEM, user=user_message).strip()


_STRUCTURED_REPORT_SYSTEM = """\
You are a clinical-reasoning assistant turning a caregiver's voice notes from a
visit into a STRUCTURED VISIT REPORT for the patient's family. The output is
rendered as a tabular template (Vitals / Mood & Energy / Meds), so you MUST
return JSON that matches the schema exactly. Do not include any prose outside
the JSON object.

For each section:
- Fill in only what the caregiver actually said. Use null where the data is
  truly absent — DO NOT invent.
- "flag.severity" is one of: "critical" (red), "warning" (amber), "good"
  (green), "none" (no badge). Pick:
    - critical: vitals out of usual range, missed critical med, refused care
    - warning: poor sleep, low energy, mild concern
    - good:    notable positive (e.g. ate full meal, took meds even when low)
    - none:    nothing remarkable
- "flag.label" is the short headline shown in color (≤ 4 words).
- "flag.note" is an optional one-line explanation (≤ 10 words).
- For meds.flag.meds, list each medication mentioned with taken=true/false.

SCHEMA (return EXACTLY this shape; null where unknown):
{
  "vitals": {
    "bp": string|null,        // e.g. "BP 142/88"
    "pulse": string|null,     // e.g. "pulse 76"
    "temp": string|null,      // e.g. "Temp 98.6" or "Temp not taken"
    "flag": { "severity": "critical"|"warning"|"good"|"none",
              "label": string, "note": string|null }
  },
  "mood": {
    "value": string,          // e.g. "Fine", "Cheerful", "Quiet"
    "flag": { "severity": "critical"|"warning"|"good"|"none",
              "label": string, "note": string|null }
  },
  "meds": {
    "status": string,         // e.g. "All Taken", "Some missed"
    "flag": { "severity": "critical"|"warning"|"good"|"none",
              "label": string,
              "meds": [{ "name": string, "taken": boolean }] }
  }
}

EXAMPLE (style + tone to match — terse, plain-language, no clinical jargon):
Input logs:
- 09:12: BP was 142 over 88, pulse 76. I didn't get a temp.
- 09:30: She slept poorly last night, the neighbors were loud. Mood is fine though.
- 10:05: Gave Lisinopril and Metformin. She's out of Vitamin D again, we need a refill.

Correct output:
{
  "vitals": {
    "bp": "BP 142/88",
    "pulse": "pulse 76",
    "temp": "Temp not taken",
    "flag": { "severity": "critical", "label": "Above usual range", "note": "Temp not taken" }
  },
  "mood": {
    "value": "Fine",
    "flag": { "severity": "warning", "label": "Slept poorly", "note": "Influenced by noise" }
  },
  "meds": {
    "status": "All Taken",
    "flag": {
      "severity": "good",
      "label": "Out of Vitamin D",
      "meds": [{"name": "Lisinopril", "taken": true}, {"name": "Metformin", "taken": true}]
    }
  }
}

Note how the flag.label is a SHORT headline (≤ 4 words) and flag.note is a
single short clause. Use the same compact, observational tone.
"""


def compile_structured_report(patient_name: str, logs: list[dict]) -> dict:
    """
    Returns a structured VisitReport dict matching the schema in
    _STRUCTURED_REPORT_SYSTEM. Empty `logs` yields a sentinel "no data" report
    so the UI can still render.
    """
    if not logs:
        return {
            "vitals": {"bp": None, "pulse": None, "temp": None,
                       "flag": {"severity": "none", "label": "No data", "note": None}},
            "mood":   {"value": "—",
                       "flag": {"severity": "none", "label": "No data", "note": None}},
            "meds":   {"status": "—",
                       "flag": {"severity": "none", "label": "No data", "meds": []}},
        }

    parts: list[str] = []
    for log in logs:
        time = (log.get("created_at") or "").split("T")[-1][:5]
        transcript = (log.get("transcript") or "").strip()
        urgent = " [URGENT]" if log.get("urgent") else ""
        parts.append(f"- {time}{urgent}: {transcript}")

    user_message = (
        f"Patient: {patient_name}\n"
        f"Visit logs (oldest first):\n" + "\n".join(parts) +
        "\n\nReturn the JSON visit report."
    )

    raw = _call_gemma(system=_STRUCTURED_REPORT_SYSTEM, user=user_message, json_mode=True)
    return _parse_json_response(raw)


def format_report_for_family(patient_name: str, visit_date: str, report: dict) -> str:
    """
    Turn the structured VisitReport into a human-readable message body that
    the family will see in their chat. Plain text, no markdown — chat bubbles
    don't render formatting.
    """
    def line(label: str, value, flag: dict | None) -> str:
        bits = [f"{label}: {value if value not in (None, '', '—') else 'n/a'}"]
        if flag and flag.get("severity") != "none" and flag.get("label"):
            note = f" — {flag['note']}" if flag.get("note") else ""
            bits.append(f"   ⚠ {flag['label']}{note}")
        return "\n".join(bits)

    vitals = report.get("vitals") or {}
    mood = report.get("mood") or {}
    meds = report.get("meds") or {}

    vitals_value = ", ".join(
        v for v in [vitals.get("bp"), vitals.get("pulse"), vitals.get("temp")] if v
    ) or "—"

    out = [
        f"Visit report — {patient_name} ({visit_date})",
        "",
        line("Vitals", vitals_value, vitals.get("flag")),
        "",
        line("Mood & Energy", mood.get("value"), mood.get("flag")),
        "",
        line("Meds", meds.get("status"), meds.get("flag")),
    ]
    meds_list = ((meds.get("flag") or {}).get("meds")) or []
    if meds_list:
        out.append("   " + ", ".join(
            f"{m['name']} {'✓' if m.get('taken') else '✗'}" for m in meds_list
        ))
    return "\n".join(out)
