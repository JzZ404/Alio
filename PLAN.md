# Alio — UI Prototype Plan

> **Product:** Alio — AI copilot for elder care connecting seniors, caregivers, and adult children.
> **Tagline:** "When you can't be there, Alio is."

## Product

Caregiving app with **3 portals** sharing one design system:

1. **Caregiver portal** — voice-first visit notes, mobile-optimized (IN SCOPE)
2. **Family portal** — dashboard, AI Check, chat, records (IN SCOPE)
3. **Elder portal** — simple calendar, one-tap call, voice reminders (DEFERRED — build after caregiver + family)

Backend (FastAPI + Gemma + auth) is **out of scope** — engineer handles that later.

## Scope of this phase

Translate hi-fi Figma screens into a **clickable, runnable UI prototype** that:
- Can be demoed on a phone via a shared URL (no app install)
- Shows every screen at full visual fidelity to Figma
- Has working navigation between screens
- Has interactive UI states (button presses, form inputs, modals, loading/empty/error visuals)
- Uses **fake/hardcoded data** — no real backend calls
- Is structured so an engineer can wire real data in later without rebuilding screens

**In scope:** Caregiver portal (4 tabs), Family portal (4 tabs).
**Deferred:** Elder portal (build after main two).
**Skipped (stubbed):** Auth, signup, onboarding. Single "Continue" button enters the app.

**Out of scope (engineer's territory):**
- Auth, sessions, JWT
- FastAPI / Gemma / any backend
- Real data persistence
- Real notifications / push / SMS
- App Store submission

## Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Vercel** for deployment (one URL per portal)
- **Monorepo** (pnpm + Turborepo) so 3 portals share one design system

## Architecture

```
alio/
  apps/
    caregiver/       ← Next.js app — caregiver portal (in scope)
    family/          ← Next.js app — family portal (in scope)
    elder/           ← Next.js app — elder portal (deferred)
  packages/
    ui/              ← Shared components (Button, Card, Input, etc.)
    theme/           ← Design tokens from Figma (colors, type, spacing)
    mock-data/       ← Hardcoded fixtures for each screen
```

When the engineer takes over, they add `packages/api/` and `packages/supabase/` alongside what's here. Nothing we build needs to change shape.

## Sequenced plan

| Step | What | Output |
|---|---|---|
| 1 | Monorepo scaffold (pnpm + Turborepo, Next.js apps, shared packages) | All apps boot empty |
| 2 | Extract Figma design tokens → `packages/theme` | Tailwind config + CSS vars match Figma |
| 3 | Build primitives in `packages/ui` from Figma component library | Button, Input, Card, Avatar, etc. |
| 4 | Routing skeleton for each portal (placeholder pages per screen) | Tap through every screen |
| 5 | Implement screens 1:1 with Figma, portal by portal, screen by screen | One commit per screen + screenshot diff |
| 6 | Hardcoded mock data in `packages/mock-data` for each screen | Screens render with realistic-looking content |
| 7 | Wire interactive states (forms, modals, tab switches, list filtering) | App feels real |
| 8 | Polish pass: loading/empty/error visuals, transitions, gestures | Production-feel prototype |
| 9 | Deploy each portal to its own Vercel URL + write HANDOFF.md | 3 shareable URLs + clean engineer handoff |

## Per-screen workflow (step 5)

1. Pull Figma node via MCP
2. Build static layout 1:1
3. Add interactive UI states (loading / empty / error / pressed / disabled)
4. Wire navigation
5. Plug in mock data
6. Screenshot diff against Figma
7. Commit

## Handoff to engineer (later phase)

Engineer receives:
- `HANDOFF.md` — what's mocked, what to wire, where to plug in Supabase/Gemma
- 3 deployed prototypes — visual source of truth
- `packages/mock-data/` — fixtures showing the exact shape of data each screen expects (engineer turns these into real types/queries)

Engineer's job: add backend, swap mock data imports for real queries. Screens, navigation, and components don't change.

## Portal feature breakdown

### Family portal — 4 tabs
- **Home** — Caregiver status (DoorDash-style live tracking), Patient status (vitals/flags), Calendar (appointments, meds)
- **AI Check** — Chat with Gemma over local records; explains observations, never diagnoses
- **Chat** — Real-time messaging with caregiver, group chat, auto-pushed visit notes
- **Records** — Static reference: medical history, visit notes, doctor notes, meds

### Caregiver portal — 4 tabs
- **Home** — Daily task list, expandable patient cards, "I've arrived" mode, active visit checklist
- **AI Log** — Voice-first agent records observations, auto-generates visit summary, syncs to care circle
- **Chat** — Same messaging as family side, per-care-circle threads, file sharing
- **Profile** — Read-only patient profile: medical history, psychological/behavioral context

## Figma workflow

**Stage 0 (one-time setup):**
1. User provides full Figma file URL + names the relevant pages (screens page, components page)
2. Extract design tokens via `get_variable_defs` (colors, type, spacing)
3. Inventory component library via `search_design_system` / `get_libraries`
4. Write inventory report, confirm with user before scaffolding

**Stage 1 (per-screen build):**
1. User pastes one screen URL (right-click frame → Copy link)
2. Pull node via `get_design_context`
3. Build 1:1, add interactive states, plug mock data
4. Screenshot diff vs Figma, commit, user reviews
5. Repeat

## Open decisions

- **Figma file URL** — still needed.
- **CLAUDE.md** — to be written next; locks naming, scope, copy rules, per-screen workflow.

## Status

Plan drafted. Next: write CLAUDE.md, then user provides Figma URL → start Stage 0 inventory.
