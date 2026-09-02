# Feature 2 — Family tracking (caregiver arrival)

**Audience:** family member (adult child)
**Where in app:** `apps/family/app/(tabs)/home`

## What the family sees

When the family member opens the app during a caregiver's shift, the Home tab shows whether the caregiver is on her way and when she'll arrive. Inspired by the Uber-style "Almost there… arriving at 10:15" experience.

States:

- `on-the-way` — folded card, headline "Caregiver on the way"
- `arrived` — auto-expanded card with map + stepper
- `in-progress` — visit in progress
- `complete` — visit complete (links into Records / Today's Status)

## Existing UI building blocks

These already live in `packages/ui`:

- `CaregiverStatusCard` — the full folded/expanded card with map preview, stepper, and contact buttons. Driven by a single `status: CaregiverStatus` prop.
- `TodayStatusCard` — vitals + medications + "last visit by"
- `CalendarWidget` — month strip + dotted shift days

## Data shape

Already typed in `packages/mock-data/src/index.ts`:

- `CaregiverStatus = 'on-the-way' | 'arrived' | 'in-progress' | 'complete'` (line 189)
- `Caregiver` (line 191)
- `SAMPLE_CAREGIVER` (line 198)

## Demo behavior

Per `CLAUDE.md`: static map image with CSS-animated marker; status driven by the FAB cycle in `home/page.tsx` (cycles through the 4 states on click). No real GPS or websockets in the prototype.

## Status

UI scaffold present (`apps/family/app/(tabs)/home/page.tsx`). Real backend wiring deferred to the engineering phase.
