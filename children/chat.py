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
    except (json.JSONDecodeError, ValueError, OSError):
        return []


def save_chat_history(history: list[dict]) -> None:
    with open(_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)


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
