# Alio — CLAUDE.md

House rules for this folder. Read at session start, every session.

---

## Product

**Alio** — AI copilot for elder care connecting seniors, caregivers, and adult children.
Tagline: *"When you can't be there, Alio is."*

Three portals:
- **Caregiver** — voice-first visit notes, mobile-optimized (in scope)
- **Family** — dashboard, AI Check, chat, records (in scope)
- **Elder** — simple calendar, one-tap call, voice reminders (**deferred** — build after main two)

## Scope of this folder

**UI-only prototype.** Translate hi-fi Figma screens into a clickable, demoable Next.js app.

Build:
- Screens at full visual fidelity to Figma
- Working navigation between screens
- Interactive UI states (pressed, loading, empty, error, success)
- Mock data for everything

**Never** build:
- Auth, sessions, login flows (stubbed with "Continue" button)
- Supabase, database, persistence
- FastAPI, Gemma, real AI calls
- Real notifications, push, SMS
- App Store submission code

Engineer wires real backend later. This folder is UI only.

## Stack

- Next.js 14 (App Router) + React + TypeScript
- Tailwind CSS
- Monorepo: pnpm workspaces + Turborepo
- Vercel deployment (one URL per portal)

## Folder structure

```
alio/
  apps/
    caregiver/       ← in scope
    family/          ← in scope
    elder/           ← deferred (don't scaffold yet)
  packages/
    ui/              ← shared components (Button, Card, Input, etc.)
    theme/           ← design tokens extracted from Figma
    mock-data/       ← hardcoded fixtures (the implicit data contract for engineer)
```

## Design rules — non-negotiable

- **Never hardcode colors, spacing, type, or radii.** Always use tokens from `packages/theme`. If a Figma value isn't yet in tokens, add it to tokens first, then use it.
- **Mobile-first.** Breakpoints: `sm=640 md=768 lg=1024`.
- **Build component library before pages.** No one-off styling inside screens.
- **Elder portal (when built):** large text (min 18px body / 24px buttons), high contrast (WCAG AA), minimal UI, voice-first interactions where possible.

## Per-screen workflow (the build loop)

User drops one Figma screen URL. I:

1. Pull the node via Figma MCP (`get_design_context`)
2. Build static layout 1:1 with Figma
3. Add interactive UI states (pressed, loading, empty, error, success, disabled)
4. Wire navigation to/from the screen
5. Plug mock data from `packages/mock-data`
6. Screenshot diff vs Figma
7. Commit (one commit per screen)

User reviews each commit before next screen. Don't batch.

## Copy & content rules

- **Match Figma copy exactly.** Capitalization, punctuation, everything.
- **If a screen has placeholder or lorem copy, ASK before inventing.** Don't make up product copy.
- **Voice/tone:** warm, human, calm. Never clinical, alarming, or corporate.
- **Error messages:** acknowledge + tell them what to do next. Never blame the user.

## Stubbing rules (what fake looks like)

For demo-able prototype, fake these convincingly:

- **Auth/onboarding** → single "Continue" button enters the app, no real form
- **Voice recording** → fake waveform animation + hardcoded transcript reveal on a timer
- **Live caregiver tracking (Family Home)** → static map image with a CSS-animated marker
- **Real-time chat** → pre-seeded message threads, fake "typing..." animations, timed "new message" arrivals
- **AI chat responses (Family AI Check / Caregiver AI Log)** → hardcoded conversation flows, simulated typing delay
- **Medication alerts** → triggered by timer or button, not real time
- **Patient vitals** → static values pulled from `packages/mock-data`

The look and feel of "alive" matters. The data underneath doesn't.

## "Never do" rules

- Never write backend code (Supabase, FastAPI, auth, real API calls)
- Never invent product copy without asking the user
- Never hardcode design values — always tokens
- Never skip the screenshot diff before committing a screen
- Never start building screens before tokens + component library are extracted from Figma
- Never scaffold the elder app yet
- Never `git push --force`, `git reset --hard`, or any destructive git operation without explicit confirmation

## Figma

- File: https://www.figma.com/design/9oY1M8Eqn6c8KTJA0limuE/Alio
- fileKey: `9oY1M8Eqn6c8KTJA0limuE`
- User will name which pages to focus on (screens page, components/design system page)
- Ignore notes, scratch, or archived pages

## Active references

- **PLAN.md** — current build plan, phase status, open decisions. Read when user asks "where are we" or scope shifts.
- **Memory** at `~/.claude/projects/-Users-jz-Documents-aliooo/memory/` — cross-session context.

## Session start ritual

1. Read this file (CLAUDE.md)
2. Read PLAN.md for current phase
3. Check git status — what's built, what's WIP, what's untracked
4. Report current step in one sentence before proposing next action
