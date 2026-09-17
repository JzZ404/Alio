# Alio — Backend

FastAPI service that turns the caregiver's voice notes into structured visit
reports for the family, using Google's Gemma 4 model and Supabase for storage.

> *Gemma is a trademark of Google LLC. Alio is not endorsed by or affiliated
> with Google.*

The frontend lives in `../apps/{caregiver,family}` and talks to this server at
`http://localhost:8000` (configurable via `NEXT_PUBLIC_API_URL` in each app's
`.env.local`).

## Run it

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt
cp .env.example .env       # fill in GOOGLE_API_KEY + SUPABASE_*
uvicorn api:app --port 8000 --env-file .env --reload
```

The first call will hit Gemma (~5–15s); subsequent endpoints cache the
Supabase client. CORS is open (`allow_origins=["*"]`) for prototype use.

**This runs on Google's hosted Gemma, not on our fine-tuned model.** That is
the default and it needs no extra setup — just `GOOGLE_API_KEY`. Every AI call
goes to Google's servers, including the text of visit notes and lab reports.
To run our own model on your machine instead, see the next section.

## Running on the fine-tuned model (optional)

We trained our own model — Gemma 4 E2B distilled from 31B on 998 medical pairs
(see `../WRITEUP.md` and `../train/`). The backend can use it instead of
Google's, and then **no message text leaves your machine.** It is off by
default because it needs a 3.4 GB download and a server running locally.

One flag switches every AI call over: `_call_gemma()` in `medical_ai.py` is the
only place any model is contacted.

```bash
# 1. Install Ollama (https://ollama.com), then start the server.
#    macOS: brew install ollama      Windows/Linux: download from the site
ollama serve                         # leave this running in its own terminal

# 2. Build our model. Downloads ~3.4 GB the first time.
ollama create alio-medical -f backend/Modelfile.alio-medical

# 3. Tell the backend to use it.
echo "USE_LOCAL_OLLAMA=1" >> backend/.env

# 4. Restart uvicorn.
```

**Confirm it is actually being used** — this is worth doing, because if the
flag is unset everything still works, silently, on Google's model:

```bash
ollama ps                    # should list alio-medical while a call is running
```

or add a one-off print of `medical_ai.active_model_name()`, which returns
`ollama:alio-medical` on the local path and `models/gemma-4-31b-it` on the
hosted one.

**Two things to know:**

- **Cold starts cost 10–20 seconds.** Ollama unloads the model after a few
  minutes idle. The first call after a break is slow; the rest are fast.
- **Image OCR still goes to Google.** The vision step for lab-report photos
  uses hosted Gemma 4 31B regardless of this flag (`_VISION_MODEL` in
  `medical_ai.py`). Only the reasoning moves local. For fully offline image
  input you would swap that for Tesseract or a local multimodal projector.

## Endpoint reference

### Caregiver visit pipeline (the main flow)

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/transcribe` | raw audio (`application/octet-stream`) | `{transcript}` |
| `POST` | `/summarize` | `{patient_name, transcript, notes}` | `{summary, mood, medications_noted, urgent}` |
| `POST` | `/caregiver-logs/compile` | `{caregiver_id, patient_id, patient_name}` | `{id, report: VisitReport, log_count, visit_date, visit_time}` |
| `GET`  | `/caregiver-logs/report/{id}` | — | full row from `compiled_reports` |
| `POST` | `/caregiver-logs/report/format-for-family` | `{patient_name, visit_date, report}` | `{text}` |

`/transcribe` and `/summarize` are called as the caregiver speaks/saves each
log. The Alio frontend writes the resulting `caregiver_logs` row directly to
Supabase from the browser (anon key + RLS), bypassing the backend for that
single insert.

`/caregiver-logs/compile` is the **structured report** generator:
1. Loads today's `caregiver_logs` rows for `{caregiver_id, patient_id}` from
   Supabase
2. Asks Gemma to produce a JSON `VisitReport` (Vitals / Mood & Energy / Meds
   with severity flags) — see `_STRUCTURED_REPORT_SYSTEM` in `medical_ai.py`
3. Inserts the result into `compiled_reports`, returns id + structured data

`/format-for-family` is stateless — turns a `VisitReport` into the plain-text
body the caregiver app inserts into `family_messages` for the family chat.

### Legacy / supporting

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/patient` | One-field profile (`name`) from `my_info.json` |
| `GET`  | `/reports`, `/reports/{date}` | Old daily report viewer (pre-Supabase) |
| `POST` | `/reports` | Save a daily report file |
| `POST` | `/symptom-check/triage` | Multi-turn symptom triage (calls `triage_conversation`) |
| `POST` | `/symptom-check/explain` | Explain a saved daily report (calls `explain_report_question`) |
| `POST` | `/prescriptions/upload` | Parse a prescription PDF |
| `POST` | `/prescriptions/sync` | Pretend-sync from Epic (returns a hardcoded fixture) |
| `GET`  | `/prescriptions` | List parsed prescriptions |

These are not used by the Alio frontend but kept so we can wire the older
flows in later if needed.

## File map

```
backend/
├── api.py            FastAPI surface — every HTTP endpoint
├── medical_ai.py     Gemma prompts + retry_transient helper
├── report.py         summarize_report + transcribe_audio + JSON file persistence
├── prescriptions.py  PDF parser (legacy)
├── my_info.json      Single-patient sample profile (legacy)
├── requirements.txt
├── .env.example
└── README.md         (you are here)
```

`api.py` runs from this directory so flat imports work
(`from report import ...`, `from medical_ai import ...`). If you move the
files, update the imports or use `python -m`.

## How Gemma calls are structured

All AI work goes through one function, `medical_ai._call_gemma()`, which picks
the model: our fine-tune over local Ollama when `USE_LOCAL_OLLAMA=1`, otherwise
Google's hosted Gemma via `genai.Client(api_key=...)`. Adding a new AI feature
means calling that function, never a client directly — otherwise the new
feature silently ignores the flag and always talks to Google.

The hosted path is wrapped in `medical_ai.retry_transient(call, attempts=3)`
which retries on Google `INTERNAL` / `UNAVAILABLE` / `DEADLINE` / `5xx` with
exponential backoff (1s, 2s). Transient outages of ~5 seconds are absorbed
silently.

Two prompt shapes:
- **Free-text** (`compile_caregiver_logs`, `summarize_report`) — system prompt
  + transcript + reports → returns Markdown-ish text
- **JSON-structured** (`compile_structured_report`, `triage_conversation`,
  `explain_report_question`) — system prompt with explicit schema +
  `response_mime_type="application/json"` → parsed via `_parse_json_response`

The structured-report prompt includes a worked example (a fictitious Erin
visit) to anchor Gemma's tone and label format. If you change the
`VisitReport` shape on the frontend, update both the schema text AND the
example in `_STRUCTURED_REPORT_SYSTEM`.

## Supabase tables this backend reads/writes

See `../supabase/schema.sql` for definitions. Quick summary:

| Table | Written by | Read by |
|---|---|---|
| `caregiver_logs` | Caregiver app (browser, anon key) | Backend `/compile`, caregiver app rehydration |
| `compiled_reports` | Backend `/compile` | Backend `/report/{id}`, caregiver app, family app |
| `family_messages` | Caregiver app (Send to family), family chat (typed replies) | Family chat (realtime subscribe) |

All three have permissive RLS (`using (true)`, `with check (true)`) for the
prototype. Tighten before production.

## Troubleshooting

- **`KeyError: 'GOOGLE_API_KEY'`** — uvicorn isn't loading `.env`. Use the
  `--env-file .env` flag.
- **`PGRST205 "Could not find the table 'public.X'"`** — re-run
  `../supabase/schema.sql` in the Supabase dashboard SQL editor.
- **`500 INTERNAL`** from a `/compile` or `/summarize` — Gemma had a transient
  blip and the 3 retries weren't enough. Try again; if it persists, check
  `https://status.cloud.google.com/`.
- **CORS preflight failing** — only happens if you change `add_middleware`.
  Default config allows `*`.
- **`model 'alio-medical' not found`** — `ollama create` has not been run, or
  was run from a different directory. The `-f` path is relative to where you
  run it; from the repo root it is `backend/Modelfile.alio-medical`.
- **Connection refused on port 11434** — `ollama serve` is not running.
- **You set `USE_LOCAL_OLLAMA=1` and nothing changed** — uvicorn reads `.env`
  once at startup via `--env-file`; restart it. Check with `ollama ps` during
  a call.
