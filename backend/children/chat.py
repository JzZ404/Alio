import os

import requests
from google import genai
from google.genai import types
from supabase import create_client

_session = None
_supabase_client = None
_genai_client = None

_USE_LOCAL_OLLAMA = os.environ.get("USE_LOCAL_OLLAMA", "").lower() in ("1", "true", "yes")
_OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
_OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "hf.co/aarony630/alio-medical")


def _get_genai_client():
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    return _genai_client


def _build_ollama_prompt(system: str, history: list[dict], user_input: str) -> str:
    """Build full multi-turn Gemma 4 chat prompt for Ollama raw mode."""
    parts = [f"<|turn>system\n{system}<turn|>\n"]
    for entry in history:
        role = "model" if entry["role"] == "model" else "user"
        parts.append(f"<|turn>{role}\n{entry['content']}<turn|>\n")
    parts.append(f"<|turn>user\n{user_input}<turn|>\n<|turn>model\n")
    return "".join(parts)


def _call_ollama_chat(system: str, history: list[dict], user_input: str) -> str:
    payload = {
        "model": _OLLAMA_MODEL,
        "prompt": _build_ollama_prompt(system, history, user_input),
        "raw": True,
        "stream": False,
        "options": {"temperature": 0.4, "num_predict": 512, "stop": ["<turn|>"]},
    }
    r = requests.post(f"{_OLLAMA_URL}/api/generate", json=payload, timeout=180)
    r.raise_for_status()
    return r.json().get("response", "").strip()


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
        )
    return _supabase_client


def load_chat_history(patient_id: str) -> list[dict]:
    try:
        result = (
            _get_supabase()
            .table("ai_chat_history")
            .select("role,content")
            .eq("patient_id", patient_id)
            .order("created_at")
            .execute()
        )
        return [{"role": r["role"], "content": r["content"]} for r in (result.data or [])]
    except Exception:
        return []


def save_chat_history(patient_id: str, new_turns: list[dict]) -> None:
    _get_supabase().table("ai_chat_history").insert(
        [{"patient_id": patient_id, "role": t["role"], "content": t["content"]} for t in new_turns]
    ).execute()


def _load_all_context(patient_id: str) -> tuple[dict, list[dict], list[dict]]:
    sb = _get_supabase()

    info = (
        sb.table("patients").select("*").eq("id", patient_id).single().execute()
    ).data or {}

    reports = (
        sb.table("compiled_reports")
        .select("visit_date,visit_time,report")
        .eq("patient_id", patient_id)
        .order("visit_date", desc=True)
        .execute()
    ).data or []

    med_logs = (
        sb.table("caregiver_logs")
        .select("visit_date,created_at,transcript,summary,mood,medications_noted,urgent")
        .eq("patient_id", patient_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []

    return info, reports, med_logs


def build_system_prompt(info: dict, reports: list[dict], med_logs: list[dict]) -> str:
    name = info.get("name", "the patient")

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
            report_data = r.get("report") or {}
            mood_val = (report_data.get("mood") or {}).get("value", "—")
            vitals = report_data.get("vitals") or {}
            bp = vitals.get("bp") or "n/a"
            meds_status = (report_data.get("meds") or {}).get("status", "—")
            flags = []
            for section in ("vitals", "mood", "meds"):
                flag = (report_data.get(section) or {}).get("flag") or {}
                if flag.get("severity") not in (None, "none"):
                    flags.append(f'{section}: {flag.get("label", "")}')
            flag_str = f" [{', '.join(flags)}]" if flags else ""
            report_lines.append(
                f"{r['visit_date']}: mood={mood_val}, vitals={bp}, meds={meds_status}{flag_str}"
            )
        reports_section = "\n".join(report_lines)
    else:
        reports_section = "No reports available yet."

    log_section = ""
    if med_logs:
        log_lines = []
        for log in med_logs:
            time_str = (log.get("created_at") or "").split("T")[-1][:5]
            text = log.get("summary") or log.get("transcript") or ""
            meds_noted = ", ".join(log.get("medications_noted") or []) or "none"
            urgent = " [URGENT]" if log.get("urgent") else ""
            log_lines.append(
                f"  [{log.get('visit_date', '')} {time_str}]{urgent} {text} (meds: {meds_noted})"
            )
        log_section = "\n\n[Caregiver Logs]\n" + "\n".join(log_lines)

    return f"""You are an AI assistant helping family members understand {name}'s health.
Speak clearly and avoid medical jargon.
Never diagnose. You may suggest whether to contact a doctor.

[Patient Info]
Medications:
{meds}
Upcoming appointments:
{appts}

[Visit Report History]
{reports_section}{log_section}"""


def create_chat_session(system_prompt: str, history: list[dict]):
    client = _get_genai_client()
    content_history = [
        types.Content(role=entry["role"], parts=[types.Part(text=entry["content"])])
        for entry in history
    ]
    return client.chats.create(
        model="gemma-4-31b-it",
        config=types.GenerateContentConfig(system_instruction=system_prompt),
        history=content_history,
    )


def _get_session(patient_id: str):
    global _session
    if _session is None:
        info, reports, med_logs = _load_all_context(patient_id)
        system_prompt = build_system_prompt(info, reports, med_logs)
        history = load_chat_history(patient_id)
        _session = create_chat_session(system_prompt, history)
    return _session


def send_message(patient_id: str, user_input: str) -> str:
    if _USE_LOCAL_OLLAMA:
        # Stateless path — rebuild full prompt each call with history
        info, reports, med_logs = _load_all_context(patient_id)
        system_prompt = build_system_prompt(info, reports, med_logs)
        history = load_chat_history(patient_id)
        reply = _call_ollama_chat(system_prompt, history, user_input)
    else:
        chat = _get_session(patient_id)
        response = chat.send_message(user_input)
        reply = response.text

    save_chat_history(patient_id, [
        {"role": "user", "content": user_input},
        {"role": "model", "content": reply},
    ])
    return reply
