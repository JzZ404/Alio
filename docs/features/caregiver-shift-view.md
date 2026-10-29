# Feature 1 — Caregiver shift view

**Audience:** caregiver (Sarah, Janet, etc.)
**Where in app:** `apps/caregiver/app/(tabs)/home`

## What the caregiver sees

When the caregiver opens the app at the start of a shift, the Home tab shows:

- **Today's shift** — start time, end time, patient name
- **Where the patient is** — patient's home address with a map view
- **Patient context** — emergency contacts, any flagged notes for today

## Existing UI building blocks

These already live in `packages/ui`:

- `PatientCard` — expandable card (avatar, address, contacts)
- `PatientSwitcher` — pick between patients if more than one
- `TaskCard` — checklist items for today

## Data shape

Already typed in `packages/mock-data/src/index.ts`:

- `Patient` (lines 94–103)
- `PatientContact` (lines 104+)
- `SAMPLE_PATIENTS` (lines 111+)

## Status

UI scaffold present (`apps/caregiver/app/(tabs)/home/page.tsx`). Real backend wiring deferred to the engineering phase — `@alio/mock-data` is the contract.
