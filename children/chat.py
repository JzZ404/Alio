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
    except (json.JSONDecodeError, ValueError):
        return []


def save_chat_history(history: list[dict]) -> None:
    with open(_HISTORY_FILE, "w") as f:
        json.dump(history, f, indent=2)
