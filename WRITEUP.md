# Alio — *When you can't be there*

**An AI copilot for elder care, built on Gemma 4.**
**Three apps, one promise: a caregiver speaks; a daughter sees mom's report instantly.**

---

## The 2 AM phone call

Erin Yeung is 78. She lives alone in Portland. Her daughter Janet lives in Seattle. Janet would visit every weekend if she could — but she can't, so Sarah Lee visits Erin three times a week as a professional caregiver, and Janet gets... whatever Sarah has time to text her.

Today, what she gets is: *"Mom did great today!"*

Janet doesn't sleep that night. Did mom take her Metformin? Was her blood pressure okay? Has she been sleeping? Janet's options are to call Sarah every shift (intrusive), interpret a vague text (anxiety spiral), or get on a plane (impossible). This is the gap we built Alio to close.

## What Alio does

Alio turns Sarah's voice into Janet's peace of mind. **Sarah speaks her visit notes while she works. Gemma 4 turns the messy transcript into a structured medical summary. Janet sees it instantly** — vitals, mood, meds, color-coded severity flags — the moment Sarah taps *Send to family*.

The "wow" moment isn't the AI itself. It's the **gap it closes**: voice notes → 5 seconds → mom's structured report appears in her daughter's chat. No phone tag. No 2 AM dread.

## The end-to-end demo

1. **Sarah opens the caregiver app** mid-shift, taps *Press to Speak*: *"I just measured Erin's blood pressure — 142 over 88. Pulse 76. She slept poorly, the neighbors were loud. I gave her the Metformin and the Lisinopril. She's out of Vitamin D, we'll need a refill."*
2. **Live captions appear as she talks** — Web Speech API in Chromium, a FastAPI streaming fallback in every other browser. She fixes one word and taps Save.
3. After a couple more visits, she taps **+ Compile**. Gemma 4 reads every log of the day and returns a **structured JSON visit report** in <10s.
4. The report appears as a tappable "Erin's Report" card in Sarah's chat. She opens it, sees *Vitals · BP 142/88 · pulse 76 · ⚠ Above usual range · Temp not taken* — and taps **Send to family**.
5. **Cut to Janet's phone in Seattle.** Her Alio family app is open. A Supabase realtime subscription pushes the new row; the same structured card **materializes in her chat thread without a refresh**. She also sees the visit listed in the Records tab alongside lab reports and prescriptions.

The whole flow takes less time than Sarah used to spend writing one text.

## How we use Gemma 4 specifically

Gemma 4 isn't a chatbot here. It's a **structured-data engine.** Two distinct prompts power the product:

**1. Per-log summary** (`summarize_report`) — Sarah's raw transcript → `{summary, mood, medications_noted, urgent}`. Free-text out; drives the in-chat AI bubble.

**2. End-of-visit structured compile** (`compile_structured_report`) — all today's transcripts → a strict JSON `VisitReport`:

```json
{
  "vitals": {"bp": "...", "pulse": "...", "temp": "...",
             "flag": {"severity": "critical|warning|good|none", "label": "...", "note": "..."}},
  "mood":   {"value": "...", "flag": {...}},
  "meds":   {"status": "...", "flag": {..., "meds": [{"name": "...", "taken": true}]}}
}
```

We use Gemma 4 with `response_mime_type="application/json"` and a **worked example** baked into the system prompt — a fictitious Erin visit phrased exactly like the UI displays — to anchor the model's tone. Each `flag.severity` drives the red/amber/green color in the rendered report.

Two design choices make this trustworthy:

- **Refusal to invent.** The prompt explicitly tells Gemma to use `null` where data is absent. We verified empirically: when we removed vitals from the transcript, Gemma left them `null` instead of hallucinating.
- **Hard escalation rules.** A separate `triage_conversation` prompt (used by the family's AI Check screen) carries a non-negotiable rule set — chest pain, sudden weakness, slurred speech, etc. *always* force `urgency: "emergency"`. The Python wrapper double-checks Gemma's output and overrides if the model softened it. Safety isn't a prompt — it's an assertion.

## The architecture

```
Caregiver app (Next.js, 3001)         Family app (Next.js, 3002)
       │                                      │
       │ fetch /transcribe                    │ Supabase realtime subscribe
       │       /summarize                     │ + /caregiver-logs/report/{id}
       │       /caregiver-logs/compile        │
       ▼                                      ▼
FastAPI on :8000  ────google.genai───►  Gemma 4 (31B Instruct)
       │
       │ supabase-py
       ▼
Supabase Postgres
  ├ caregiver_logs    (raw transcript + per-log summary)
  ├ compiled_reports  (jsonb VisitReport from Gemma 4)
  └ family_messages   (chat thread, realtime-enabled, nullable report_id)
```

The frontend talks to Supabase directly for cheap reads/writes; the backend exists where Gemma 4 is involved. Realtime is on `family_messages` only — the family chat subscribes via WebSocket; reports arrive without polling.

## Three engineering decisions we'd defend

**1. Browser-native STT with a server fallback.** Web Speech API is free, instant, and uses Google's STT — but only in Chromium browsers with Google credentials. We learned this when Opera silently produced no captions. A `MediaRecorder` now runs *in parallel* with Web Speech in every browser; if Web Speech emits a `network` error or stays silent for 5 seconds, a watchdog activates chunk polling — 3-second audio segments shipped to FastAPI `/transcribe`. Users see captions either way.

**2. `jsonb` for the visit report, not a normalized schema.** The `VisitReport` shape evolves with prompt tuning. A normalized `vitals_bp text` / `mood_value text` schema would force migrations every iteration. `jsonb` lets us add fields by editing the prompt and the two TypeScript interfaces — no SQL.

**3. Retry with exponential backoff (1s, 2s, 4s) on Gemma 4 `INTERNAL` errors.** During development we saw Gemma return `500 INTERNAL` for ~10 seconds at a stretch. Three retries with backoff absorb the full outage window invisibly. If all three fail, we show *"AI service hiccuped — tap again"* instead of the raw error.

## Challenges we overcame

- **Silent inserts.** Supabase's JS client serializes omitted columns as explicit `NULL`, defeating our `default current_date` on `visit_date`. Every insert failed silently for half a day before we noticed — we'd suppressed the error to `console.warn`. Fix: pass the date explicitly *and* surface persist failures to the UI banner. Lesson: silent failures cost hours.
- **Opera doesn't speak Google.** Half the team uses non-Chromium Chromium forks (Opera, Brave) that don't ship Google STT credentials. The chunk-polling fallback above was the answer.
- **Tailwind silently dropped my colors.** Severity colors in the family chat rendered as black until we noticed Tailwind's `content` config didn't scan our new `components/` folder. Arbitrary classes like `text-[#F65E69]` only generate when Tailwind sees them statically in source.
- **Two AI agents in parallel.** We built parts of this with concurrent Claude sessions. They created a real `MessageView` merge conflict that we hand-resolved by combining both branches' switch cases. Coordination cost is real even between AI agents.

## Why this isn't just a chatbot wrapper

Three things distinguish Alio from "talk to a model about elder care":

1. **Two-sided value from one input.** Sarah's time is the binding constraint in caregiving. The same voice note that satisfies *her* documentation requirement also produces *Janet's* report. One human input, two human outputs.
2. **Structured output that drives the UI.** Gemma 4's JSON drives color-coded severity flags that an exhausted caregiver and an anxious daughter can both parse in 2 seconds. Free-text would let the model ramble; the schema forces it to commit.
3. **Realtime arrival.** Janet doesn't refresh. The report appears the second Sarah hits Send. The difference between *"I'll check when I get home"* and *"Mom is okay right now"* is what we're really shipping.

## What's next

- **Auth + multi-patient.** Today everything is hardcoded to `caregiver-001 + erin-yeung`. Supabase Auth + RLS by `auth.uid()` is one PR away.
- **Inline editing on the report template.** The edit pencils are visible but inert; wiring them closes the loop.
- **Streaming STT for long visits.** Chunk polling re-uploads the full accumulated audio each time. For 5-minute monologues we'd switch to a websocket against Google's streaming STT API.

## Links

- **Repo (branch `feat/caregiver`):** https://github.com/JzZ404/Alio
- **Architecture deep-dive:** [`ARCHITECTURE.md`](https://github.com/JzZ404/Alio/blob/feat/caregiver/ARCHITECTURE.md)
- **10-minute setup:** [`SETUP.md`](https://github.com/JzZ404/Alio/blob/feat/caregiver/SETUP.md)
- **Backend API reference:** [`backend/README.md`](https://github.com/JzZ404/Alio/blob/feat/caregiver/backend/README.md)

> *"When you can't be there, Alio is."*

---

*Gemma is a trademark of Google LLC. Alio uses Google's Gemma 4 models
(`gemma-4-31b-it` via the Gen AI SDK, and a fine-tuned `gemma-4-e2b-it`
variant published at [huggingface.co/aarony630/alio-medical](https://huggingface.co/aarony630/alio-medical))
to power its visit summarization and structured report generation. We are
not endorsed by or affiliated with Google.*
