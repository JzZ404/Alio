# Alio

> AI copilot for elder care connecting seniors, caregivers, and adult children.
> *"When you can't be there, Alio is."*

This repo holds the full Alio stack: two Next.js apps (caregiver + family), a
FastAPI backend that talks to Google Gemma, and a Supabase Postgres database
with realtime subscriptions. A caregiver speaks visit notes; the family sees a
structured report the moment the caregiver sends it.

## Quick start

Three processes, run in three terminals (or background them).

```bash
# 1. Backend  (Python, port 8000)
cd backend
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # fill in GOOGLE_API_KEY + SUPABASE_*
uvicorn api:app --port 8000 --env-file .env --reload

# 2. Frontend  (Node, ports 3001 + 3002)
pnpm install
pnpm dev                       # both apps in parallel
# or: pnpm dev:caregiver       # localhost:3001
# or: pnpm dev:family          # localhost:3002

# 3. Database  (one-time, in Supabase web SQL editor)
# Paste supabase/schema.sql → Run
```

Full walkthrough: see [SETUP.md](SETUP.md).
Architecture / data flow / table reference: see [ARCHITECTURE.md](ARCHITECTURE.md).

## What's in the box

```
.
├── apps/
│   ├── caregiver/         Next.js 14 App Router app (port 3001)
│   └── family/            Next.js 14 App Router app (port 3002)
├── packages/
│   ├── theme/             Design tokens + Tailwind preset + Century Gothic + globals.css
│   ├── ui/                Shared components + 288 generated Caesarzkn icons
│   └── mock-data/         Typed fixtures — implicit data contract for the engineer
├── backend/               FastAPI + Google Gemma — see backend/README.md
│   ├── api.py
│   ├── medical_ai.py
│   ├── report.py
│   └── requirements.txt
├── supabase/
│   └── schema.sql         Three tables (caregiver_logs, compiled_reports,
│                          family_messages) + RLS policies + realtime
├── icons/                 SVG source files for the icon generator (one-time use)
├── scripts/
│   └── generate-icons.mjs Regenerates packages/ui/src/icons/*.gen.tsx from icons/
├── ARCHITECTURE.md        Data flow, table reference, where each feature lives
├── SETUP.md               Step-by-step new-engineer onboarding
└── .figma-refs/           Reference screenshots from Figma (visual diff baseline)
```

## Source-of-truth docs

| File | What |
|---|---|
| [SETUP.md](SETUP.md) | Step-by-step setup for a fresh clone |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack diagram, data flow, table & endpoint reference |
| [backend/README.md](backend/README.md) | Backend-specific (every endpoint, every prompt) |
| [CLAUDE.md](CLAUDE.md) | House rules for AI agents picking this up |
| [DESIGN.md](DESIGN.md) | Design system (colors, type, radii, spacing, text styles, animations) |
| [INVENTORY.md](INVENTORY.md) | Screen inventory from initial Figma extraction |
| [PLAN.md](PLAN.md) | Original UI build plan + scope |

## Tech stack

- **Frontend:** Next.js 14 App Router + React 18 + TypeScript + Tailwind CSS;
  pnpm workspaces monorepo
- **Backend:** FastAPI + uvicorn (Python ≥ 3.11)
- **AI:** Google Gemma (`models/gemma-4-31b-it`) via the `google-genai` SDK,
  with retry + exponential backoff on transient errors
- **Database:** Supabase (Postgres + realtime + RLS) — three tables, no auth
  yet (anon key only; tighten policies before production)
- **Browser STT:** Web Speech API (Chrome/Edge) with fallback to backend
  `/transcribe` chunk-polling every 3s for Opera/Firefox/Brave/Safari
- **Fonts:** Century Gothic, loaded via `next/font/local` from
  `packages/theme/fonts/`

## App structure

Each app has its own tab bar. Different sets per portal.

**Caregiver portal** (port 3001) — Sarah Mitchell's view
- `/home` — patient schedule with expandable patient cards
- `/logs` — voice-first visit log → live captions → review → Save → structured
  report via the **+** button → tappable card in chat → opens
  `/logs/report/[id]` for the template view → **Send to family**
- `/chat` — care circle threads + `/chat/[id]` 1:1
- `/profiles` — placeholder

**Family portal** (port 3002) — Janet's view of Mom (Dorothy Chen)
- `/home` — caregiver status card + Today's Status vitals + calendar +
  upcoming appointments
- `/ai-check` — voice / message conversation with the AI assistant
- `/chat` + `/chat/[id]` — care thread; Sarah's compiled reports stream in
  via Supabase realtime and render as structured `ReportCard` inline
- `/records` — medical record list (lab reports, prescriptions); the **Visit**
  filter shows compiled caregiver reports; tap → `/records/visit/[id]`

## For the engineer picking this up

The data contract lives in two places that you'll touch when wiring real
data:

1. `packages/mock-data/src/index.ts` — typed fixtures (`Patient`, `Caregiver`,
   `ChatMessage`, `ConversationTurn`, etc.). Screens import named exports;
   swap with hooks (`usePatients()`, `useThreadMessages(id)`) returning the
   same shape and screens keep rendering.
2. `apps/{caregiver,family}/lib/supabase.ts` — the Supabase client +
   table-row types (`FamilyMessageRow`, `CompiledReportRow`, `VisitReport`).
   These already drive the caregiver Log rehydration, family chat realtime,
   and Records visit list.

The simulated transcript stream in `/ai-check` is still wall-clock-based —
wire it to real STT events when the AI service lands.

## Icons

288 Caesarzkn icons + a handful of custom ones live in `packages/ui/src/icons/`.
To regenerate from SVGs in `/icons/`:

```bash
pnpm icons:generate
```

The generator (`scripts/generate-icons.mjs`) normalizes hardcoded colors to
`currentColor` so icons can be themed via CSS.

## Design assets

- Figma file (reference): `9oY1M8Eqn6c8KTJA0limuE` — ask the team for access
- Local screenshots from Figma (visual diff baseline): `.figma-refs/`

## Status

- ✅ Phase 1 UI prototype: caregiver Home + Logs + Chat, family Home + AI Check
- ✅ Phase 2 backend wiring: FastAPI + Gemma + Supabase, structured visit
  reports end-to-end, realtime family chat
- ⏳ Phase 3: real auth (replace hardcoded `caregiver-001` / `dorothy-chen`),
  multi-patient, elder portal, edit-section affordances on the report template
