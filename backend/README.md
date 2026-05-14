# Alio — Backend

FastAPI service that turns the caregiver's voice notes into structured visit
reports for the family, using Google's Gemma model and Supabase for storage.

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

All AI work goes through a single client (`genai.Client(api_key=...)`) and is
wrapped in `medical_ai.retry_transient(call, attempts=3)` which retries on
Google `INTERNAL` / `UNAVAILABLE` / `DEADLINE` / `5xx` with exponential
backoff (1s, 2s). Transient outages of ~5 seconds are absorbed silently.

Two prompt shapes:
- **Free-text** (`compile_caregiver_logs`, `summarize_report`) — system prompt
  + transcript + reports → returns Markdown-ish text
- **JSON-structured** (`compile_structured_report`, `triage_conversation`,
  `explain_report_question`) — system prompt with explicit schema +
  `response_mime_type="application/json"` → parsed via `_parse_json_response`

The structured-report prompt includes a worked example (a fictitious Dorothy
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
