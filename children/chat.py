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
        for r in sorted(reports, key=lambda r: r["date"], reverse=True):
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
