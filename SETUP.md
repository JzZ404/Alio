# Alio — Setup

Step-by-step from a fresh clone to all three services running locally.
Should take ~10 minutes if you have Node, Python, and a Supabase project
ready.

If you just want to read about the system, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Prerequisites

- **Node** ≥ 20 (`node --version`)
- **pnpm** ≥ 9 — install with `npm install -g pnpm` or `corepack enable && corepack prepare pnpm@latest --activate`
- **Python** ≥ 3.11 (`python --version`)
- A **Supabase project** (free tier is fine — https://supabase.com/dashboard)
- A **Google AI API key** for Gemma — https://aistudio.google.com/apikey

## 1. Clone and install

```bash
git clone https://github.com/JzZ404/Alio.git
cd Alio
git checkout feat/caregiver           # the integration branch
pnpm install                          # installs all three workspace packages + both apps
```

## 2. Set up the database

Open your Supabase project → SQL Editor → **+ New query** → paste the
contents of `supabase/schema.sql` → **Run**. You should see
`Success. No rows returned`. Three new tables appear in Table Editor:
`caregiver_logs`, `compiled_reports`, `family_messages`.

The script is `if not exists`-guarded throughout — safe to re-run any time
the schema changes.

## 3. Configure secrets

You need three secrets, used in **two places** (backend `.env`, both apps'
`.env.local`).

**From Supabase Dashboard → Project Settings → API:**
- `Project URL` → use as `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / `publishable` key → use as `SUPABASE_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**From Google AI Studio (https://aistudio.google.com/apikey):**
- Create an API key → use as `GOOGLE_API_KEY`

Then:

```bash
# Backend
cp backend/.env.example backend/.env
# edit backend/.env — fill in all three values

# Caregiver app
cp apps/caregiver/.env.example apps/caregiver/.env.local
# edit apps/caregiver/.env.local — fill in NEXT_PUBLIC_SUPABASE_*

# Family app
cp apps/family/.env.example apps/family/.env.local
# edit apps/family/.env.local — fill in NEXT_PUBLIC_SUPABASE_*
```

The `NEXT_PUBLIC_API_URL` in each `.env.example` already defaults to
`http://localhost:8000` — leave it unless you're hosting the backend
elsewhere.

## 4. Install backend Python deps

```bash
cd backend
python -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

## 5. Run all three processes

In three terminals (or background each):

```bash
# Terminal 1 — backend on :8000
cd backend
source .venv/bin/activate              # if not already
uvicorn api:app --port 8000 --env-file .env --reload

# Terminal 2 — both Next.js apps in parallel
pnpm dev
# → caregiver: http://localhost:3001
# → family:    http://localhost:3002

# (Alternatively, in separate terminals)
# pnpm dev:caregiver
# pnpm dev:family
```

If pnpm's `runDepsStatusCheck` keeps failing on Windows (we've hit
EPERM-on-Program-Files issues on OneDrive paths), you can bypass it by
running each app directly:

```bash
cd apps/caregiver && ./node_modules/.bin/next dev -p 3001
cd apps/family    && ./node_modules/.bin/next dev -p 3002
```

## 6. Smoke test

Open http://localhost:3001/logs (caregiver). You should see:
- Patient pill "Dorothy Chen" in the top-left
- "Hi, I am listening" + the gradient blob in the middle
- Press to Speak button at the bottom

Test the live transcript:
- In **Chrome or Edge**: tap Press to Speak, allow mic, talk → words appear
  live in a card above the button (Web Speech).
- In **other browsers**: tap Press to Speak, talk → words appear every ~3s
  via the FastAPI `/transcribe` fallback.

Test the full flow:
1. Press to Speak → talk → Done → Save
2. Repeat once more
3. Tap **+** → "Compiling…" appears → switches to message view with a
   tappable "Dorothy's Report" card
4. Tap the card → opens the structured report template
5. Tap **Send to family**
6. Open http://localhost:3002/chat/sarah-caregiver in another tab → the
   structured Vitals / Mood & Energy / Meds card appears **without a
   refresh** (Supabase realtime)
7. Open http://localhost:3002/records → tap the **Visit** filter → see the
   same report listed; tap it for the full template

If any step fails:
- 500 from `/compile` or `/summarize` → Gemma blip; tap again
- "Could not find the table" → re-run `supabase/schema.sql`
- "Could not reach the AI service" → backend isn't running
- Live captions show "Recognition: network" → expected on Opera/Brave/etc.;
  recording continues, the fallback delivers the transcript on Done

Full troubleshooting list: [backend/README.md](backend/README.md#troubleshooting)

## 7. Make it your own

Hardcoded identities to swap in `apps/caregiver/app/(tabs)/logs/page.tsx`:
- `CAREGIVER_ID = 'caregiver-001'`
- `CAREGIVER_NAME = 'Sarah Mitchell'`

And in `apps/family/app/(tabs)/chat/[id]/page.tsx`:
- `SUPABASE_THREAD_FOR['sarah-caregiver'] = 'caregiver-001__dorothy-chen'`

When auth lands, replace all of these with values from `auth.uid()`.

## Where to go next

- **Adding a new feature?** Read [ARCHITECTURE.md](ARCHITECTURE.md) first —
  understand the data flow before adding endpoints.
- **Changing the AI prompts?** Edit `backend/medical_ai.py`. The
  structured-report prompt has a worked example; keep its format in sync
  with `VisitReport` on both the caregiver and family side.
- **Changing the design?** Read [CLAUDE.md](CLAUDE.md) for the UI team's
  rules (design tokens, no hardcoded values, etc.).
