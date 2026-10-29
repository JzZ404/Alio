# SPEC.md — Alio 🤝

> **"When you can't be there, Alio is."**
> An AI-powered elder care platform connecting seniors, their in-home caregivers, and remote adult children — in one coordinated system.

---


## Team

**Murphy Wei, Joyce Zhou, Yunxiao Du, Aaron Yeung**
The Gemma 4 Good Hackathon

---

## Project Overview

Every day, thousands of seniors live alone — one caregiver visiting for a few hours, one adult child worrying from another city, and nothing connecting them. Notes get lost. Medications get missed. The family finds out too late.

Alio fixes that.

Alio is an AI copilot for elder care that connects their in-home caregiver, and their remote adult child — in one coordinated platform. 

**The caregiver** finishes a home visit, speaks a quick voice note, and moves on. Alio transcribes it, structures it, runs a health check against the elder's full medical history, and sends a clean summary to the family — automatically.

**The adult child**, managing their parent's care from another city, opens Alio and sees everything. Every visit. Every medication. Every flag. They can upload medical records, sync appointments, and track health trends over time. No phone tag. No second-hand updates.

One visit. Two people informed. Zero dropped balls.

---

## The Problem

When a caregiver visits an elder's home, what they observe rarely reaches the family in any useful form. Notes get lost, medications get missed, the adult child has no real window into daily conditions. Existing tools like Caring Village solve coordination for families that already have an active network. Alio is built for elders who don't — living alone, with one in-home caregiver and maybe one adult child in another city.

---

## Issue 1: Project structure and data model

### Tasks
- Initialize React Native (Expo) project with file-based routing
- Set up Supabase project and connect to app
- Create `elders` table (id, name, dob, diagnoses, medications, allergies, care_notes)
- Create `caregivers` table (id, name, user_id, client_ids)
- Create `family_members` table (id, name, user_id, elder_id)
- Create `visit_logs` table (id, elder_id, caregiver_id, voice_transcript, ai_summary, flags, created_at)
- Create `medical_records` table (id, elder_id, uploaded_by, file_url, extracted_text, record_type, date)
- Create `appointments` table (id, elder_id, title, datetime, location, notes, created_by)
- Set up environment variables and Supabase Realtime subscriptions

### Acceptance Criteria
- [ ] All tables exist in Supabase with correct foreign keys
- [ ] App runs locally on iOS simulator and Android emulator
- [ ] Supabase Realtime pushes visit log updates to family view within 3 seconds

---

## Issue 2: Caregiver app — Home dashboard and client list

### Tasks
- Build bottom tab navigation: Home, Log Visit, Clients, Chat
- Home screen: today's schedule, upcoming visits, AI alert banner for flagged clients
- Client list screen: client cards with status badges (Stable / Monitor / Visit Due)
- Client detail sheet: diagnoses, medications, allergies, emergency contacts, care notes, AI pre-visit briefing
- Live clock component showing current time and date

### Acceptance Criteria
- [ ] Caregiver sees all assigned clients on home screen
- [ ] Client cards show name, age, status, last visit, and any active flags
- [ ] Client detail sheet loads within 1 second
- [ ] AI pre-visit briefing pulls from the elder's most recent visit log and medical record

---

## Issue 3: Caregiver app — Voice visit log and AI health check

### Tasks
- Build voice recording flow: tap to record → Gemma 4 transcribes → AI structures into visit note
- AI visit note fields: observations, medications taken, mood, mobility, flags
- After transcription, run symptom check against elder's diagnosis and medication history
- If flags detected (e.g. elevated BP, missed medication, unusual behavior), generate alert for family
- Allow caregiver to review, edit, and confirm AI-generated note before sending
- Support photo upload as alternative/supplement to voice (image recognition via Gemma 4)

### Acceptance Criteria
- [ ] Voice recording transcribed and structured within 5 seconds
- [ ] Symptom check runs against elder's full history using Gemma 4's 256K context window
- [ ] Flags surface within the note review screen before submission
- [ ] Confirmed note syncs to family view within 3 seconds via Supabase Realtime
- [ ] Photo upload extracts visible conditions or medication labels via image recognition

---

## Issue 4: Caregiver app — Multi-client management

### Tasks
- Caregiver profile supports 2–3 active client profiles
- Switch between clients without logging out
- Each client maintains separate visit log history, medical records, and AI summaries
- Notification badge on client card when a flag is unresolved

### Acceptance Criteria
- [ ] Caregiver can manage up to 3 clients from one account
- [ ] Switching between client profiles takes under 1 second
- [ ] Each client's data is fully isolated

---

## Issue 5: Family app — Home dashboard and real-time status

### Tasks
- Build bottom tab navigation: Home, AI Check, Records, Chat
- Home screen: today's status strip (medications, last visit, upcoming appointment, mood)
- Real-time visit log feed: caregiver's latest note, AI summary, any active flags
- Mini calendar showing caregiver visit days and upcoming appointments
- Push notification when a new visit log arrives or a flag is raised

### Acceptance Criteria
- [ ] Family sees latest visit summary within 3 seconds of caregiver submitting
- [ ] Status strip reflects current-day data (medication, visit, appointment)
- [ ] Push notification fires on new flag or visit log
- [ ] Calendar correctly marks visit days and appointment dates

---

## Issue 6: Family app — Medical records upload and AI summary

### Tasks
- Upload flow: photo, PDF, or file picker → Gemma 4 extracts structured data
- Extracted fields: record type, date, provider, key findings, medications, follow-up actions
- Records organized by type (lab results, prescriptions, imaging, discharge summaries)
- AI generates plain-language summary of each record for non-clinical readers
- Full record history searchable by date and type

### Acceptance Criteria
- [ ] Upload completes and AI summary appears within 10 seconds
- [ ] Extracted data correctly identifies record type, date, and key findings
- [ ] Plain-language summary is accurate and avoids clinical jargon
- [ ] Records are searchable and filterable

---

## Issue 7: Family app — Appointment management

### Tasks
- Add, edit, and view upcoming appointments
- Appointment fields: title, date/time, location, provider, notes, transportation needed
- Appointment syncs to caregiver view so caregiver is aware of upcoming visits
- Reminder notification sent to family 24 hours and 1 hour before appointment
- AI suggests follow-up questions to ask at appointment based on recent visit logs and medical history

### Acceptance Criteria
- [ ] Appointment created by family is visible to caregiver within 3 seconds
- [ ] Reminder notifications fire at 24h and 1h before appointment
- [ ] AI follow-up question suggestions are specific to the elder's current conditions

---

## Issue 8: Family app — AI health check (ask anything)

### Tasks
- Conversational AI interface for family to ask questions about their parent's health
- AI has full context: medical records, visit logs, medications, appointment history
- Response cites source (e.g. "Based on Dorothy's visit on May 3...")
- Hard guardrail: AI always recommends consulting a doctor for clinical decisions
- Conversation history saved per session

### Acceptance Criteria
- [ ] AI responds within 5 seconds
- [ ] Responses cite the specific source data they draw from
- [ ] Every response about symptoms or treatment includes a disclaimer to consult a provider
- [ ] AI does not hallucinate medications or diagnoses not present in the elder's records

---

## Issue 10: In-app messaging (Caregiver ↔ Family)

### Tasks
- Direct message thread between caregiver and family member
- Pre-built quick-reply templates (e.g. "Running 10 min late", "Please call me", "All good today")
- Message thread linked to specific elder profile
- Unread badge on chat tab

### Acceptance Criteria
- [ ] Messages delivered within 2 seconds via Supabase Realtime
- [ ] Quick-reply templates available in one tap
- [ ] Chat history persists across sessions

---

## Issue 11: Deploy and end-to-end testing

### Tasks
- Deploy backend to Supabase (production project)
- Submit to TestFlight (iOS) and Google Play internal testing (Android)
- Test full flow: caregiver logs visit → family sees update → family uploads record → AI summary generated
- Seed demo data: 3 elder profiles, 5 visit logs, medical records, upcoming appointments
- Share demo build link for hackathon demo day

### Acceptance Criteria
- [ ] App installable via TestFlight and Google Play internal track
- [ ] Full end-to-end flow works without errors on physical devices
- [ ] Demo data seeded and visible without any setup
- [ ] All three interfaces (Caregiver, Family, Elder tablet) work in the demo build

---

## User Stories

### Caregiver
- **As a caregiver**, I want to see all my clients and today's schedule on one screen so that I know exactly where I need to be and when.
- **As a caregiver**, I want to record a voice note at the end of each visit so that I can document what happened without typing.
- **As a caregiver**, I want the AI to check my visit observations against the elder's medical history so that I catch anything I might have missed.
- **As a caregiver**, I want to review and confirm the AI-generated note before it sends so that I stay in control of what gets shared.
- **As a caregiver**, I want to manage multiple client profiles from one account so that I don't need separate apps for each client.

### Family (Adult Child)
- **As a family member**, I want to see a summary of today's caregiver visit as soon as it's submitted so that I know my parent is okay without calling anyone.
- **As a family member**, I want to be notified immediately if the caregiver flags something concerning so that I can act quickly.
- **As a family member**, I want to upload my parent's medical records and have the AI summarize them in plain language so that I can understand what the doctor said.
- **As a family member**, I want to manage my parent's appointments and have the caregiver automatically see them so that we don't miss anything.
- **As a family member**, I want to ask the AI questions about my parent's health using their full history so that I can make informed decisions without calling the doctor for every question.
- **As a family member**, I want to message the caregiver directly in the app so that we don't have to manage a separate text thread.

---

## Views / Pages

| Interface | View | Description |
|-----------|------|-------------|
| **Caregiver** | Home Dashboard | Today's schedule, client status cards, AI alert banner |
| **Caregiver** | Client Detail | Full profile: diagnoses, meds, allergies, contacts, AI pre-visit briefing |
| **Caregiver** | Log Visit | Voice recording → AI transcription → structured note → review → send |
| **Caregiver** | Client List | All assigned clients with status badges and flags |
| **Caregiver** | Chat | Direct message thread with family member |
| **Family** | Home Dashboard | Status strip, latest visit summary, real-time flag alerts, mini calendar |
| **Family** | Medical Records | Upload, AI extraction, plain-language summary, record history |
| **Family** | Appointments | Add/edit appointments, AI follow-up question suggestions |
| **Family** | AI Health Check | Conversational AI with full elder context, source citations |
| **Family** | Chat | Direct message thread with caregiver |

---

## AI Features

1. **Voice Visit Transcription** — Caregiver records a voice note after each visit. Gemma 4 transcribes and structures it into a standardized visit note (observations, medications taken, mood, mobility, flags).

2. **Symptom & History Check** — After transcription, Gemma 4 checks observations against the elder's full medical history, medication list, and prior visit logs using the 256K context window. Flags anomalies (e.g. elevated BP, missed dose, unusual behavior).

3. **Medical Record Extraction** — Family uploads a photo, PDF, or file. Gemma 4 extracts structured data (record type, date, provider, key findings, medications) and generates a plain-language summary for non-clinical readers.

4. **AI Pre-Visit Briefing** — Before each caregiver visit, Gemma 4 generates a short briefing: what to watch for today, based on the elder's most recent visit log, upcoming medication schedule, and any open flags.

5. **Family AI Health Check** — Conversational interface for family members to ask questions about their parent's health. AI draws from the full medical record, visit log history, and medication data. Every clinical response includes a disclaimer to consult a provider.

6. **Appointment Follow-Up Suggestions** — Before an upcoming appointment, Gemma 4 reviews recent visit logs and medical history and suggests specific questions for the family to ask the doctor.

---

## Data Model

**`elders` table**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| name | text | Elder's full name |
| dob | date | Date of birth |
| diagnoses | text[] | List of diagnoses with year |
| medications | jsonb | Array of {name, dose, frequency} |
| allergies | text[] | Known allergies |
| care_notes | text | Caregiver preferences and personal notes |
| created_at | timestamp | |

**`visit_logs` table**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| elder_id | uuid | FK → elders |
| caregiver_id | uuid | FK → caregivers |
| voice_url | text | Raw audio file URL |
| transcript | text | Gemma 4 transcription |
| ai_summary | text | Structured AI-generated note |
| flags | text[] | Array of flagged observations |
| medications_taken | boolean[] | Per-medication confirmation |
| created_at | timestamp | |

**`medical_records` table**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| elder_id | uuid | FK → elders |
| uploaded_by | uuid | FK → family_members |
| file_url | text | Storage URL |
| extracted_text | text | Gemma 4 extraction |
| ai_summary | text | Plain-language summary |
| record_type | text | lab / prescription / imaging / discharge |
| record_date | date | Date of the record |
| created_at | timestamp | |

**`appointments` table**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| elder_id | uuid | FK → elders |
| created_by | uuid | FK → family_members |
| title | text | Appointment name |
| datetime | timestamptz | Date and time |
| location | text | Clinic or address |
| notes | text | Additional notes |
| ai_suggestions | text[] | AI-generated follow-up questions |

**`messages` table**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| elder_id | uuid | FK → elders (links thread to care circle) |
| sender_id | uuid | FK → caregivers or family_members |
| sender_role | text | "caregiver" or "family" |
| body | text | Message content |
| created_at | timestamp | |

---

## Tech Stack

- **Frontend**: Next.js (App Router) — web app, mobile-responsive
- **Backend / DB**: Supabase (Postgres + Supabase Realtime for live sync)
- **AI**: Gemma 4 via Google AI API — voice transcription, image recognition, symptom check, record extraction, conversational health check
- **Storage**: Supabase Storage — voice recordings, uploaded medical records, photos
- **Push Notifications**: Expo Notifications
- **Deployment**: Expo EAS Build → TestFlight + Google Play internal track

---

## Must-Have Feature (Definition of Done)

> A caregiver finishes a home visit, records a 30-second voice note, and the adult child — in another city — receives a clean AI-generated summary with any health flags within 60 seconds. No phone call. No text message. No dropped ball.

---

## Out of Scope (for this sprint)

- Direct EHR / hospital portal integration (manual upload only for now)
- Multi-language support (English only for demo)
- Billing or payment flows
- Web app (mobile only)
- More than 3 elder profiles per caregiver account
- Video calling

---

## Responsible AI Guardrails

- AI **never makes clinical decisions** — all symptom checks surface as flags for human review, not diagnoses
- Caregiver **always reviews and confirms** AI-generated visit note before it is sent to the family
- Family AI health check **always appends** a disclaimer: *"This is not medical advice. Please consult your parent's doctor for clinical decisions."*
- Medical data **processed on-device where possible** — only structured output (summaries, flags, calendar events) syncs to the cloud, never raw records
- AI responses **cite their source** — every answer references the specific visit log or medical record it draws from

---

## Acceptance Criteria

- [ ] Caregiver voice note transcribed and structured within 5 seconds of recording
- [ ] AI symptom check runs and flags surface before caregiver submits the note
- [ ] Confirmed visit note visible to family within 3 seconds via Supabase Realtime
- [ ] Family push notification fires within 5 seconds of a new flag
- [ ] Medical record upload produces AI summary within 10 seconds
- [ ] Elder tablet medication reminder fires at correct scheduled time
- [ ] All elder tablet touch targets are minimum 60px
- [ ] AI health check responds within 5 seconds and cites source data
- [ ] App installable and fully functional via TestFlight track on demo day
- [ ] Demo data seeded: 1 elder profiles, 3-5 visit logs, 2-4 medical records, 1-2 upcoming appointments

---

## Complexity

**Ambitious** — Three coordinated interfaces + real-time sync + on-device AI inference + multimodal input (voice, camera, file upload) in ~60–80 developer hours.
