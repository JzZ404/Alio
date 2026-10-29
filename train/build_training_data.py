"""
build_training_data.py
======================
Generates (input, output) training pairs for fine-tuning Gemma 4 E2B on medical
text simplification.  Uses Gemma 4 31B via the Google GenAI API as the teacher.

Setup
-----
1. Download the Medical Transcriptions dataset into ./data/:
     https://www.kaggle.com/datasets/tboyle10/medicaltranscriptions
   (You should end up with data/mtsamples.csv)

   Lab panels are GENERATED synthetically inside this script — no Kaggle lab
   dataset needed. The generator emits realistic CMP/CBC/Lipid/HbA1c/Hep C/TSH
   panels in MyChart/Epic format, matching what the app actually receives.

2. Set GOOGLE_API_KEY in your environment (same key your app already uses).

3. Run:
     python build_training_data.py

Output
------
  data/train.jsonl  — ~90% of pairs, ShareGPT chat format for Unsloth
  data/val.jsonl    — ~10% of pairs

Each line:
  {"conversations": [
      {"from": "system", "value": "<system prompt>"},
      {"from": "human",  "value": "<medical input>"},
      {"from": "gpt",    "value": "<plain-language output>"}
  ]}
"""

import json
import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Windows defaults to cp1252 — force UTF-8 everywhere so unicode chars in
# Gemma's output don't crash file reads or log writes mid-run.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

load_dotenv()  # populate GOOGLE_API_KEY from ./.env

from medical_ai import retry_transient

_checkpoint_lock = threading.Lock()

# ── config ────────────────────────────────────────────────────────────────────
DATA_DIR = Path("data")
CHECKPOINT_FILE = DATA_DIR / "build_checkpoint.jsonl"
TRAIN_FILE = DATA_DIR / "train.jsonl"
VAL_FILE = DATA_DIR / "val.jsonl"

TARGET_TRANSCRIPTION_PAIRS = 1000   # rows from medicaltranscriptions.csv (filtered ~997 available)
TARGET_LAB_PAIRS = 700              # synthetic lab panels (now ~15 panel types)
TARGET_TRIAGE_PAIRS = 300           # symptom triage scenarios with JSON outputs
VAL_FRACTION = 0.10
MAX_WORKERS = 16                    # paid tier — workers limited by API latency, not RPM
REQUESTS_PER_MINUTE = 300           # paid tier allows ~1000 RPM; 300 leaves headroom
MODEL = "models/gemma-4-31b-it"


class _RateLimiter:
    """Global token bucket. Blocks until a request slot is free."""

    def __init__(self, rpm: int):
        self.interval = 60.0 / rpm
        self.last = 0.0
        self.lock = threading.Lock()

    def acquire(self):
        with self.lock:
            now = time.time()
            wait = self.last + self.interval - now
            if wait > 0:
                time.sleep(wait)
            self.last = time.time()


_rate_limiter = _RateLimiter(REQUESTS_PER_MINUTE)

RELEVANT_SPECIALTIES = {
    "General Medicine",
    "Internal Medicine",
    "Geriatrics",
    "Cardiology / Pulmonary",
    "Neurology",
    "Nephrology",
    "Endocrinology",
    "Hematology - Oncology",
    "Discharge Summary",
    "SOAP / Chart / Progress Notes",
    "Office Notes",
}

# ── system prompts (mirrors your existing app prompts) ────────────────────────
_NURSE_NOTE_SYSTEM = """\
You are a medical assistant helping family members understand a patient's health.
You will receive a clinical note written by a nurse or caregiver. It may contain
medical jargon, abbreviations, or technical terms.

Your job: rewrite it as a plain-language summary (3-5 sentences) that a family
member with no medical background can understand. No jargon. No diagnosis.
Mention: overall condition, key events or observations, any medications noted,
and anything the family should watch for.

Reply in EXACTLY this JSON format with no extra text:
{
  "summary": "...",
  "mood": "...",
  "medications_noted": ["..."],
  "urgent": false
}
Set urgent=true only if the note describes an emergency (chest pain, loss of
consciousness, severe breathing difficulty, etc.)."""

_TRIAGE_SYSTEM = """\
You are a clinical-reasoning assistant helping triage a patient's symptoms.
You are NOT giving a diagnosis. Produce a triage urgency level with a
plain-language explanation when you have enough information.

Urgency levels (use EXACTLY one of these strings):
- "emergency"  — call 911 or go to the ER now
- "today"      — see a doctor or urgent care today
- "this_week"  — schedule a visit this week
- "self_care"  — monitor at home, no visit needed

Hard escalation rules (NON-NEGOTIABLE — these always force urgency="emergency"):
- chest pain
- sudden one-sided weakness or numbness
- slurred speech
- sudden severe headache
- trouble breathing
- severe bleeding
- loss of consciousness

Reply in EXACTLY this JSON format with no extra text:
{"needs_followup": false, "urgency": "...", "explanation": "...", "watch_for": ["...", "..."]}

"explanation" must be 2-4 sentences in plain language (no jargon).
"watch_for" must be 2-3 short items the patient or family should watch for."""


_TRIAGE_GENERATOR_PROMPT = """\
Generate 20 diverse, realistic patient-facing symptom reports.

Mix the severity:
- 7 self_care  (mild/routine — e.g. mild headache, minor cold, low energy, stuffy nose)
- 6 this_week  (should see doctor this week — recurring symptoms, mild but persistent)
- 4 today      (should see doctor same day — fever with concerning features, severe pain)
- 3 emergency  (call 911 — chest pain, breathing trouble, slurred speech, severe bleeding, loss of consciousness, sudden one-sided weakness)

Each one should be 1-3 sentences in NATURAL first-person speech, like a real
patient or caregiver describing how they feel. Vary:
- Speaker: sometimes the patient themselves, sometimes a family member describing the patient
- Patient age: mix of elderly, middle-aged, younger adult
- Specificity: some vague ("I just don't feel right"), some precise ("BP was 158/95 this morning")
- Time markers: "for the past 3 days", "since this morning", "every afternoon"

Output ONLY a JSON array of 20 strings with no other text:
["scenario 1", "scenario 2", ..., "scenario 20"]
"""


_LAB_SYSTEM = """\
You are a medical assistant helping a patient or family member understand lab
results. You will receive a list of lab test names, their values, and reference
ranges. Some may be flagged as High or Low.

Your job: write a plain-language explanation (3-5 sentences) of what the results
mean overall. Focus on: what is normal, what is flagged and why it matters,
and whether the family should follow up with a doctor soon.

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

# ── helpers ───────────────────────────────────────────────────────────────────

def _client() -> genai.Client:
    return genai.Client(api_key=os.environ["GOOGLE_API_KEY"])


def _call_model(client: genai.Client, system: str, user: str) -> str | None:
    _rate_limiter.acquire()
    try:
        response = retry_transient(lambda: client.models.generate_content(
            model=MODEL,
            config=types.GenerateContentConfig(
                system_instruction=system,
                response_mime_type="application/json",
            ),
            contents=user,
        ))
        return (response.text or "").strip()
    except Exception as e:
        # 429s mean we're still hitting the cap — back off and let the
        # rate limiter naturally space subsequent calls.
        err_str = str(e)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            time.sleep(2)
            print(f"  [429] backing off …")
        else:
            print(f"  [skip] API error: {err_str[:120]}")
        return None


def _to_chat_row(system: str, user: str, assistant: str) -> dict:
    return {
        "conversations": [
            {"from": "system", "value": system},
            {"from": "human",  "value": user},
            {"from": "gpt",    "value": assistant},
        ]
    }


def _load_checkpoint() -> set[str]:
    """Return set of already-processed user messages (content-based so dedup
    survives across runs — Python's hash() is randomized per process)."""
    seen: set[str] = set()
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, encoding="utf-8") as f:
            for line in f:
                try:
                    row = json.loads(line)
                    for turn in row.get("conversations", []):
                        if turn.get("from") == "human":
                            seen.add(turn["value"])
                            break
                except Exception:
                    pass
    return seen


def _append_checkpoint(id_: str, row: dict):
    with _checkpoint_lock:
        with open(CHECKPOINT_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps({"_id": id_, **row}, ensure_ascii=False) + "\n")


def _process_task(client: genai.Client, id_: str, system: str, user: str) -> tuple[str, dict] | None:
    """Run one API call. Returns (id, chat_row) on success, None on failure."""
    output = _call_model(client, system, user)
    if not output:
        return None
    try:
        json.loads(output)
    except json.JSONDecodeError:
        return None
    return id_, _to_chat_row(system, user, output)


# ── source 1: medical transcriptions ─────────────────────────────────────────

def _find_transcriptions_csv() -> Path | None:
    for name in ("mtsamples.csv", "medicaltranscriptions.csv", "medical_transcriptions.csv"):
        p = DATA_DIR / name
        if p.exists():
            return p
    candidates = list(DATA_DIR.glob("*.csv"))
    # pick the largest CSV (most likely to be the transcriptions file)
    if candidates:
        return max(candidates, key=lambda p: p.stat().st_size)
    return None


def build_transcription_pairs(client: genai.Client, seen: set[str], limit: int) -> list[dict]:
    csv_path = _find_transcriptions_csv()
    if csv_path is None:
        print("[transcriptions] No CSV found in ./data/ — skipping.")
        print("  Run: kaggle datasets download -d tboyle10/medicaltranscriptions -p data --unzip")
        return []

    print(f"[transcriptions] Loading {csv_path.name} …")
    df = pd.read_csv(csv_path)
    print(f"  Columns: {list(df.columns)}")
    print(f"  Total rows: {len(df)}")

    # normalise column names to lowercase
    df.columns = [c.lower().strip() for c in df.columns]

    # filter to relevant specialties if column exists
    if "medical_specialty" in df.columns:
        mask = df["medical_specialty"].str.strip().isin(RELEVANT_SPECIALTIES)
        filtered = df[mask].copy()
        print(f"  Rows after specialty filter: {len(filtered)}")
        if len(filtered) < 200:
            print("  (too few after filter — using all rows)")
            filtered = df.copy()
    else:
        filtered = df.copy()

    # find the transcription text column
    text_col = None
    for candidate in ("transcription", "text", "note", "content", "description"):
        if candidate in filtered.columns:
            text_col = candidate
            break
    if text_col is None:
        print("  [skip] Could not find a text column in this CSV.")
        return []

    filtered = filtered.dropna(subset=[text_col])
    filtered = filtered[filtered[text_col].str.len() > 100]
    filtered = filtered.sample(frac=1, random_state=42).reset_index(drop=True)

    # Build the task queue (skip if user message already in checkpoint)
    tasks: list[tuple[str, str, str]] = []
    for _, row in filtered.iterrows():
        if len(tasks) >= limit:
            break
        text = str(row[text_col]).strip()
        user_msg = f"Clinical note:\n\n{text[:3000]}"
        if user_msg in seen:
            continue
        id_ = f"tx_{abs(hash(text)) & 0xFFFFFFFF:08x}"
        tasks.append((id_, _NURSE_NOTE_SYSTEM, user_msg))

    print(f"  Submitting {len(tasks)} tasks across {MAX_WORKERS} workers …")
    pairs: list[dict] = []
    completed = 0
    start = time.time()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(_process_task, client, *t): t[0] for t in tasks}
        for fut in as_completed(futures):
            completed += 1
            result = fut.result()
            if result is None:
                continue
            id_, chat_row = result
            _append_checkpoint(id_, chat_row)
            seen.add(id_)
            pairs.append(chat_row)
            if completed % 25 == 0 or completed == len(tasks):
                elapsed = time.time() - start
                rate = completed / elapsed if elapsed else 0
                eta = (len(tasks) - completed) / rate if rate else 0
                print(f"  [transcriptions] {completed}/{len(tasks)} done "
                      f"({len(pairs)} kept) — {rate:.1f}/s, eta {eta/60:.1f} min")

    print(f"[transcriptions] Generated {len(pairs)} pairs.")
    return pairs


# ── source 2: synthetic lab panels ────────────────────────────────────────────
# Real reference ranges from major US labs (Quest, LabCorp, Epic defaults).
# Each test: (name, unit, low, high, flag_direction).
#   flag_direction: "both" = flag outside [low,high]
#                   "high" = flag only when > high (e.g. cholesterol, A1c)
#                   "low"  = flag only when < low

LAB_PANELS = {
    "Comprehensive Metabolic Panel": [
        ("Sodium",               "mmol/L", 135,   145,   "both"),
        ("Potassium",            "mmol/L",   3.5,   5.3, "both"),
        ("Chloride",             "mmol/L",  99,   109,   "both"),
        ("Carbon Dioxide",       "mmol/L",  20,    36,   "both"),
        ("Anion Gap",            "mmol/L",   5,    16,   "both"),
        ("Glucose",              "mg/dL",   65,    99,   "both"),
        ("BUN",                  "mg/dL",    8,    25,   "both"),
        ("Creatinine",           "mg/dL",    0.70,  1.30,"both"),
        ("Calcium",              "mg/dL",    8.5,  10.2, "both"),
        ("Albumin",              "g/dL",     3.5,   5.0, "both"),
        ("Total Protein",        "g/dL",     6.2,   8.2, "both"),
        ("AST",                  "U/L",     10,    45,   "high"),
        ("ALT",                  "U/L",     10,    65,   "high"),
        ("Alkaline Phosphatase", "U/L",     35,   115,   "high"),
        ("Bilirubin Total",      "mg/dL",    0.0,   1.5, "high"),
    ],
    "Complete Blood Count": [
        ("WBC",         "K/uL",  4.0,  11.0, "both"),
        ("RBC",         "M/uL",  4.2,   5.9, "both"),
        ("Hemoglobin",  "g/dL", 12.0,  17.5, "both"),
        ("Hematocrit",  "%",    36,    52,   "both"),
        ("MCV",         "fL",   80,   100,   "both"),
        ("Platelets",   "K/uL", 150,  400,   "both"),
    ],
    "Lipid Panel": [
        ("Total Cholesterol", "mg/dL",   0, 200, "high"),
        ("HDL Cholesterol",   "mg/dL",  40, 100, "low"),
        ("LDL Cholesterol",   "mg/dL",   0, 100, "high"),
        ("Triglycerides",     "mg/dL",   0, 150, "high"),
    ],
    "Hemoglobin A1c": [
        ("Hemoglobin A1c", "%", 4.0, 5.7, "high"),
    ],
    "Hepatitis C Antibody": [
        ("Hep C Antibody", "S/CO", 0.0, 1.0, "high"),
    ],
    "Thyroid (TSH)": [
        ("TSH", "uIU/mL", 0.45, 4.5, "both"),
    ],
    "Basic Metabolic Panel": [
        ("Sodium",     "mmol/L", 135,  145,  "both"),
        ("Potassium",  "mmol/L",   3.5,  5.3,"both"),
        ("Chloride",   "mmol/L",  99,  109,  "both"),
        ("Glucose",    "mg/dL",   65,   99,  "both"),
        ("BUN",        "mg/dL",    8,   25,  "both"),
        ("Creatinine", "mg/dL",    0.70, 1.30,"both"),
        ("Calcium",    "mg/dL",    8.5, 10.2,"both"),
    ],
    "Vitamin D, 25-Hydroxy": [
        ("Vitamin D, 25-OH", "ng/mL", 30, 100, "low"),
    ],
    "Vitamin B12": [
        ("Vitamin B12", "pg/mL", 200, 900, "low"),
    ],
    "Folate (Vitamin B9)": [
        ("Folate", "ng/mL", 3.0, 17.0, "low"),
    ],
    "Iron Panel": [
        ("Iron",         "ug/dL", 60,  170, "both"),
        ("TIBC",         "ug/dL", 250, 450, "both"),
        ("Transferrin",  "mg/dL", 200, 360, "both"),
        ("Ferritin",     "ng/mL", 30,  400, "both"),
        ("Iron Saturation","%",   20,   50, "both"),
    ],
    "Magnesium": [
        ("Magnesium", "mg/dL", 1.7, 2.2, "both"),
    ],
    "Phosphorus": [
        ("Phosphorus", "mg/dL", 2.5, 4.5, "both"),
    ],
    "PSA (Prostate Screen)": [
        ("PSA, Total", "ng/mL", 0.0, 4.0, "high"),
    ],
    "Thyroid Panel (Full)": [
        ("TSH",       "uIU/mL", 0.45, 4.5, "both"),
        ("Free T4",   "ng/dL",  0.8,  1.8, "both"),
        ("Free T3",   "pg/mL",  2.3,  4.2, "both"),
    ],
}

# Weighted panel distribution (CMP is the most common)
_PANEL_WEIGHTS = {
    "Comprehensive Metabolic Panel": 25,
    "Complete Blood Count":          18,
    "Lipid Panel":                   12,
    "Hemoglobin A1c":                 7,
    "Basic Metabolic Panel":          8,
    "Thyroid (TSH)":                  4,
    "Thyroid Panel (Full)":           3,
    "Vitamin D, 25-Hydroxy":          6,
    "Vitamin B12":                    4,
    "Folate (Vitamin B9)":            2,
    "Iron Panel":                     5,
    "Magnesium":                      2,
    "Phosphorus":                     1,
    "PSA (Prostate Screen)":          1,
    "Hepatitis C Antibody":           2,
}


def _sample_value(low: float, high: float, flag_direction: str, abnormal: bool) -> tuple[float, str]:
    """Return (value, status) where status is 'Normal', 'High', or 'Low'."""
    span = high - low
    if not abnormal:
        # Sample within range, biased toward the middle
        val = random.uniform(low + 0.1 * span, high - 0.1 * span)
        return round(val, 2), "Normal"
    # abnormal: pick a direction allowed by flag_direction
    options = []
    if flag_direction in ("high", "both"):
        options.append("High")
    if flag_direction in ("low", "both"):
        options.append("Low")
    direction = random.choice(options) if options else "High"
    if direction == "High":
        val = random.uniform(high + 0.05 * span, high + 0.6 * span)
    else:
        val = random.uniform(max(0, low - 0.6 * span), low - 0.05 * span)
    return round(val, 2), direction


def _generate_synthetic_panel(rng_seed: int) -> tuple[str, str]:
    """Generate one synthetic lab panel as (text_input, panel_name)."""
    random.seed(rng_seed)
    # Pick a panel by weight
    panels, weights = zip(*_PANEL_WEIGHTS.items())
    panel_name = random.choices(panels, weights=weights, k=1)[0]
    tests = LAB_PANELS[panel_name]

    # Decide overall pattern: 60% all normal, 30% one or two abnormal, 10% multiple
    r = random.random()
    if r < 0.60:
        n_abnormal = 0
    elif r < 0.90:
        n_abnormal = random.choice([1, 1, 2])
    else:
        upper = min(4, len(tests))
        n_abnormal = random.randint(min(2, upper), upper)
    # Cap by panel size for single-test panels (HbA1c, Hep C, TSH).
    n_abnormal = min(n_abnormal, len(tests))
    abnormal_idx = set(random.sample(range(len(tests)), k=n_abnormal))

    # Random date in the last 6 months
    days_back = random.randint(1, 180)
    collected = (date.today() - timedelta(days=days_back)).strftime("%b %d, %Y")

    # Build the text in MyChart/Epic style
    lines = [
        f"Lab Results: {panel_name}",
        f"Collected on {collected}",
        "",
    ]
    for i, (name, unit, low, high, direction) in enumerate(tests):
        val, status = _sample_value(low, high, direction, abnormal=(i in abnormal_idx))
        if isinstance(low, float) and low < 10:
            range_str = f"{low}-{high}"
        else:
            range_str = f"{int(low)}-{int(high)}"
        flag = "" if status == "Normal" else f" {status}"
        lines.append(f"  {name}: {val} {unit}  (Normal range: {range_str}){flag}")

    return "\n".join(lines), panel_name


def build_lab_pairs(client: genai.Client, seen: set[str], limit: int) -> list[dict]:
    print(f"[lab] Preparing {limit} synthetic panels …")

    # Pre-generate unique panels (dedupe by panel text against checkpoint)
    tasks: list[tuple[str, str, str]] = []
    used_texts: set[str] = set()
    attempt = 0
    while len(tasks) < limit and attempt < limit * 4:
        attempt += 1
        text, panel_name = _generate_synthetic_panel(rng_seed=attempt)
        if text in seen or text in used_texts:
            continue
        used_texts.add(text)
        id_ = f"lab_{abs(hash(text)) & 0xFFFFFFFF:08x}"
        tasks.append((id_, _LAB_SYSTEM, text))

    print(f"  Submitting {len(tasks)} tasks across {MAX_WORKERS} workers …")
    pairs: list[dict] = []
    completed = 0
    start = time.time()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(_process_task, client, *t): t[0] for t in tasks}
        for fut in as_completed(futures):
            completed += 1
            result = fut.result()
            if result is None:
                continue
            id_, chat_row = result
            _append_checkpoint(id_, chat_row)
            seen.add(id_)
            pairs.append(chat_row)
            if completed % 25 == 0 or completed == len(tasks):
                elapsed = time.time() - start
                rate = completed / elapsed if elapsed else 0
                eta = (len(tasks) - completed) / rate if rate else 0
                print(f"  [lab] {completed}/{len(tasks)} done "
                      f"({len(pairs)} kept) — {rate:.1f}/s, eta {eta/60:.1f} min")

    print(f"[lab] Generated {len(pairs)} pairs.")
    return pairs


# ── source 3: symptom triage ──────────────────────────────────────────────────

def build_triage_pairs(client: genai.Client, seen: set[str], limit: int) -> list[dict]:
    """Generate symptom scenarios in batches via 31B, then triage each one."""
    print(f"[triage] Generating {limit} symptom triage pairs …")

    # Step 1: generate diverse symptom scenarios in batches of 20
    n_batches = (limit + 19) // 20
    all_scenarios: list[str] = []
    print(f"  [triage] Step 1: requesting {n_batches} batches of 20 scenarios …")
    for batch in range(n_batches):
        if len(all_scenarios) >= int(limit * 1.2):  # 20% buffer for failures
            break
        # Vary the user message to encourage diverse outputs
        user_msg = f"Generate batch #{batch+1}. Focus on a mix of severities and ages."
        out = _call_model(client, _TRIAGE_GENERATOR_PROMPT, user_msg)
        if not out:
            continue
        try:
            parsed = json.loads(out)
            if isinstance(parsed, list):
                for s in parsed:
                    if isinstance(s, str) and 20 < len(s) < 1000:
                        all_scenarios.append(s.strip())
        except (json.JSONDecodeError, TypeError):
            pass
        print(f"    batch {batch+1}/{n_batches}: total scenarios = {len(all_scenarios)}")

    print(f"  [triage] Step 2: triaging up to {min(limit, len(all_scenarios))} scenarios …")
    # Step 2: triage each scenario
    tasks: list[tuple[str, str, str]] = []
    for scenario in all_scenarios:
        if len(tasks) >= limit:
            break
        if scenario in seen:
            continue
        id_ = f"triage_{abs(hash(scenario)) & 0xFFFFFFFF:08x}"
        tasks.append((id_, _TRIAGE_SYSTEM, scenario))

    print(f"  [triage] Submitting {len(tasks)} tasks across {MAX_WORKERS} workers …")
    pairs: list[dict] = []
    completed = 0
    start = time.time()
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(_process_task, client, *t): t[0] for t in tasks}
        for fut in as_completed(futures):
            completed += 1
            result = fut.result()
            if result is None:
                continue
            id_, chat_row = result
            _append_checkpoint(id_, chat_row)
            seen.add(id_)
            pairs.append(chat_row)
            if completed % 25 == 0 or completed == len(tasks):
                elapsed = time.time() - start
                rate = completed / elapsed if elapsed else 0
                eta = (len(tasks) - completed) / rate if rate else 0
                print(f"  [triage] {completed}/{len(tasks)} done "
                      f"({len(pairs)} kept) — {rate:.1f}/s, eta {eta/60:.1f} min")

    print(f"[triage] Generated {len(pairs)} pairs.")
    return pairs


# ── split and save ────────────────────────────────────────────────────────────

def save_train_val(all_pairs: list[dict]):
    random.shuffle(all_pairs)
    split = max(1, int(len(all_pairs) * (1 - VAL_FRACTION)))
    train, val = all_pairs[:split], all_pairs[split:]

    DATA_DIR.mkdir(exist_ok=True)
    with open(TRAIN_FILE, "w", encoding="utf-8") as f:
        for row in train:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    with open(VAL_FILE, "w", encoding="utf-8") as f:
        for row in val:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"\nSaved {len(train)} train rows → {TRAIN_FILE}")
    print(f"Saved {len(val)} val rows   → {VAL_FILE}")


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    DATA_DIR.mkdir(exist_ok=True)
    client = _client()
    seen = _load_checkpoint()
    print(f"Resuming from checkpoint: {len(seen)} pairs already done.\n")

    tx_pairs     = build_transcription_pairs(client, seen, TARGET_TRANSCRIPTION_PAIRS)
    lab_pairs    = build_lab_pairs(client, seen, TARGET_LAB_PAIRS)
    triage_pairs = build_triage_pairs(client, seen, TARGET_TRIAGE_PAIRS)

    all_pairs = tx_pairs + lab_pairs + triage_pairs

    # also reload any previously checkpointed pairs not in this run
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, encoding="utf-8") as f:
            for line in f:
                try:
                    row = json.loads(line)
                    row.pop("_id", None)
                    if row not in all_pairs:
                        all_pairs.append(row)
                except Exception:
                    pass

    print(f"\nTotal pairs: {len(all_pairs)}")
    if all_pairs:
        save_train_val(all_pairs)
    else:
        print("No pairs generated — check that CSV files are in ./data/")


if __name__ == "__main__":
    main()
