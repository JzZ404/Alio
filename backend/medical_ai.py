import json
import os
import re
from datetime import datetime

from google import genai
from google.genai import types

_MODEL_NAME = "models/gemma-4-31b-it"

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
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = retry_transient(lambda: client.models.generate_content(
        model=_MODEL_NAME,
        config=types.GenerateContentConfig(system_instruction=system_prompt),
        contents=_format_conversation_as_text(conversation),
    ))
    parsed = _parse_json_response(response.text)
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
    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = retry_transient(lambda: client.models.generate_content(
        model=_MODEL_NAME,
        config=types.GenerateContentConfig(system_instruction=system_prompt),
        contents=user_message,
    ))
    parsed = _parse_json_response(response.text)
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

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = retry_transient(lambda: client.models.generate_content(
        model=_MODEL_NAME,
        config=types.GenerateContentConfig(system_instruction=_COMPILE_LOGS_SYSTEM),
        contents=user_message,
    ))
    return (response.text or "").strip()


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

    client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    response = retry_transient(lambda: client.models.generate_content(
        model=_MODEL_NAME,
        config=types.GenerateContentConfig(
            system_instruction=_STRUCTURED_REPORT_SYSTEM,
            response_mime_type="application/json",
        ),
        contents=user_message,
    ))
    return _parse_json_response(response.text or "")


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
