# Alio — Architecture

How the three processes (caregiver app, family app, FastAPI backend) and
Supabase fit together to deliver one piece of value: **caregiver speaks
visit notes → family sees a structured report in their chat, instantly.**

For setup steps, see [SETUP.md](SETUP.md). For endpoint-by-endpoint detail,
see [backend/README.md](backend/README.md).

## System diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│   ├─ http://localhost:3001  → Alio CAREGIVER app  (Next.js 14)   │
│   └─ http://localhost:3002  → Alio FAMILY    app  (Next.js 14)   │
└─────────────────────────────────────────────────────────────────┘
                │                                  │
                │ /transcribe                      │ GET /caregiver-logs/report/{id}
                │ /summarize                       │
                │ /caregiver-logs/compile          │
                │ /caregiver-logs/report/{id}      │
                │ /caregiver-logs/report/          │
                │    format-for-family             │
                ▼                                  ▼
       ┌──────────────────────────────────────────────────┐
       │  FastAPI on :8000  (backend/api.py, Python ≥ 3.11)│
       │   ├─ medical_ai.py    (Gemma prompts + retry)     │
       │   └─ report.py        (visit summarizer + STT)    │
       └──────────────────────────────────────────────────┘
                │                          │
                │ supabase-py              │ google.genai
                ▼                          ▼
       ┌──────────────────┐       ┌───────────────────────┐
       │  Supabase (cloud)│       │  Google Gemma API     │
       │  ├ caregiver_logs│       │  models/gemma-4-31b-it│
       │  ├ compiled_…    │       └───────────────────────┘
       │  └ family_messages│
       └──────────────────┘
                ▲ realtime subscribe
                │
       Family chat at :3002 listens for new family_messages rows
       (no polling — Supabase pushes via WebSocket)
```

The two Next.js apps also call **Supabase directly from the browser** for
inserts and realtime subscriptions, using the anon (publishable) key. The
backend uses the same anon key from `SUPABASE_KEY` env var; tighten the RLS
policies in `supabase/schema.sql` before any non-prototype use.

## End-to-end story for one visit

1. **Sarah opens** caregiver `/logs`, taps **Press to Speak**
2. Audio streams to **Web Speech** for live captions (Chrome/Edge).
   If Web Speech errors with `network` (Opera/Firefox/Brave/Safari),
   `MediaRecorder` accumulates audio chunks and ships them to
   FastAPI `/transcribe` every 3 seconds for near-live captions.
3. **Done** → review/edit screen → **Save**
4. Frontend calls FastAPI `/summarize` (Gemma) → writes the resulting row to
   Supabase `caregiver_logs` (browser → Supabase direct, no backend hop).
5. Repeat 1–4 a few times across the visit
6. Sarah taps the **+** button → frontend calls FastAPI
   `/caregiver-logs/compile`, which:
   - loads today's `caregiver_logs` for `{caregiver_id, patient_id}`
   - asks Gemma for a structured `VisitReport` (Vitals / Mood & Energy /
     Meds with severity flags)
   - inserts the row into `compiled_reports`
   - returns `{id, report, ...}`
7. Caregiver chat appends a tappable **"Dorothy's Report"** card. Tap →
   navigates to `/logs/report/[id]`, which fetches the row via
   `/caregiver-logs/report/{id}` and renders the structured cards.
8. Sarah taps **Send to family**:
   - frontend calls `/format-for-family` (Gemma → plain text)
   - frontend inserts a row into `family_messages` with `report_id` set
9. The family app's `/chat/[id]` page (Sarah Mitchell thread) is subscribed
   to `family_messages` via Supabase realtime. The new row arrives, the page
   sees `report_id` is set, fetches `/caregiver-logs/report/{id}`, renders
   the same structured cards inline in the chat thread.
10. Family `/records` page also queries `compiled_reports` for the patient
    → the new visit shows up under the **Visit** filter; tap → opens
    `/records/visit/[id]` (the same `ReportCard`, full screen).

## Data shapes — `VisitReport`

The structured shape Gemma fills in. Defined in three places that must stay
in sync:

| Where | Why |
|---|---|
| `backend/medical_ai.py` → `_STRUCTURED_REPORT_SYSTEM` | Prompt schema text |
| `apps/caregiver/lib/api.ts` → `VisitReport` interface | Caregiver typing |
| `apps/family/lib/supabase.ts` → `VisitReport` interface | Family typing |

```ts
type Severity = 'critical' | 'warning' | 'good' | 'none';

interface ReportFlag {
  severity: Severity;
  label: string;       // ≤ 4 words, shown in flag color
  note: string | null; // ≤ 10 words, shown below
}

interface VisitReport {
  vitals: {
    bp: string | null;            // "BP 142/88"
    pulse: string | null;         // "pulse 76"
    temp: string | null;          // "Temp 98.6" or "Temp not taken"
    flag: ReportFlag;
  };
  mood: {
    value: string;                // "Fine", "Cheerful", "Quiet"
    flag: ReportFlag;
  };
  meds: {
    status: string;               // "All Taken", "Some missed"
    flag: ReportFlag & {
      meds: { name: string; taken: boolean }[];
    };
  };
}
```

Severity color rules (used in the UI):
- `critical` → red (`#F65E69`)
- `warning`  → amber (`#F79009`)
- `good`     → green (`#12B76A`)
- `none`     → no flag row rendered

## Supabase tables

Defined in `supabase/schema.sql`. Re-run that file in the Supabase SQL editor
whenever the schema changes — every statement is `if not exists`-guarded.

### `caregiver_logs`

Raw transcript + per-log Gemma summary, one row per Save tap.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | pk |
| `caregiver_id` | text | hardcoded `'caregiver-001'` for prototype |
| `patient_id` | text | hardcoded `'dorothy-chen'` for prototype |
| `visit_date` | date | sent explicitly from the client (defaults are bypassed by supabase-js) |
| `transcript` | text | what the caregiver said |
| `summary` | text \| null | from `/summarize` |
| `mood` | text \| null | from `/summarize` |
| `medications_noted` | text[] | from `/summarize` |
| `urgent` | bool | from `/summarize` |
| `created_at` | timestamptz | default `now()` |

### `compiled_reports`

The structured `VisitReport` from `/compile`, one row per **+** tap.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | pk — used as `report_id` in `family_messages` |
| `caregiver_id`, `patient_id`, `patient_name`, `visit_date`, `visit_time` | metadata |
| `report` | jsonb | the `VisitReport` |
| `source_log_count` | int | how many `caregiver_logs` rows fed this compile |
| `created_at` | timestamptz | default `now()` |

### `family_messages`

The family chat thread. Realtime-enabled (`alter publication
supabase_realtime add table family_messages`).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | pk |
| `thread_id` | text | derived as `${caregiver_id}__${patient_id}` for the Sarah↔Janet thread |
| `sender` | text | "Sarah Mitchell" |
| `text` | text | plain-text body (Gemma-formatted for report messages) |
| `report_id` | uuid \| null | when present, family chat renders ReportCard instead of ChatBubble |
| `created_at` | timestamptz | default `now()` |

Row-level security on all three tables is `using (true)` / `with check
(true)` — anyone with the anon key can read and insert. Tighten before
production.

## Identity (current state)

There is no auth yet. The frontend hardcodes:
- `caregiver_id = 'caregiver-001'` (matches `SAMPLE_CG_USER` in mock-data)
- Active patient comes from `SAMPLE_PATIENTS[0]` (`'dorothy-chen'`)
- Family thread `sarah-caregiver` is mapped to Supabase thread_id
  `caregiver-001__dorothy-chen` in `apps/family/.../chat/[id]/page.tsx`'s
  `SUPABASE_THREAD_FOR` constant

To add a second caregiver/patient pair: extend `SAMPLE_PATIENTS`, add an
entry to `SAMPLE_FM_CHAT_THREADS` (mock-data), and add a mapping to
`SUPABASE_THREAD_FOR`. Replace all of this with real `auth.uid()`-based
queries when auth lands.

## Speech-to-text strategy

Two paths, picked automatically:

| Path | When | How |
|---|---|---|
| **Web Speech API** | Chrome / Edge | Browser streams audio to Google's cloud STT; no backend hop. Near-instant interim results. Free. |
| **FastAPI `/transcribe`** chunk polling | Opera / Firefox / Brave / Safari, or Web Speech `network` error | `MediaRecorder` emits a 3-second chunk → frontend POSTs accumulated audio → server returns the latest transcript. ~3s latency. Uses the same Google API key the AI calls use. |

`MediaRecorder` runs **in parallel with Web Speech** in every browser, so the
fallback is always ready. If Web Speech goes silent for 5 seconds without
producing a result, the chunk poller activates automatically (watchdog).

## Why this shape

- **Backend stays thin.** The frontend talks to Supabase directly for simple
  reads/writes (caregiver_logs inserts, family chat realtime). The backend
  exists only where Gemma is involved (summary, structured compile, format),
  plus the legacy paths we haven't deprecated yet.
- **`compiled_reports.report` is a jsonb blob, not a normalized table.** The
  shape evolves with the prompt; a single column means schema changes don't
  require migrations. Cost: no SQL queries against `vitals.bp` etc., which
  we don't need.
- **`family_messages.report_id` is nullable.** Lets the chat carry both
  plain text bubbles (typed replies) and structured reports without two
  tables or a polymorphic mess.
- **Realtime on `family_messages` only.** The caregiver app re-reads
  `caregiver_logs` and `compiled_reports` on mount; realtime there would be
  nice but isn't load-bearing for the demo.

## Open issues for the next person

- **Edit pencils on the report template are visual only** — tapping them
  does nothing. Wiring inline section editing is one slice of work.
- **`visit_time` is the time of the compile call**, not the time of the
  first log. Cosmetic — could derive from earliest `created_at` in
  `caregiver_logs` for that day.
- **Each `/transcribe` poll re-sends the full accumulated audio.** Works for
  short visit notes; for ≥ 5-minute monologues, switch to streaming STT
  (websocket or SSE) on the backend.
- **No multi-day report compilation.** `compile` filters
  `visit_date = current_date`. Add a date param for "compile yesterday's
  visit".
- **No tests yet.** The Gemma repo has pytest tests for the report module
  (`tests/test_report.py` etc.); those would port over to `backend/tests/`
  with minor import tweaks.
