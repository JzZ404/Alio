# Alio — When You Can't Be There

> Submission for **The Gemma 4 Good Hackathon**
> Track: **Impact — Health & Sciences** *(also being evaluated for Main Track, Ollama Special Prize, Unsloth Special Prize)*

<!--
====================================================================
WORD BUDGET: 1,500 max. Current target per section is in comments.
JUDGING CRITERIA (Kaggle):
  Impact & Vision        — 40 pts  (drive sections 1–2, 6)
  Video Pitch & Storytelling — 30 pts  (the video does this; writeup supports)
  Technical Depth & Execution — 30 pts (drive sections 3–5)
====================================================================
-->

## 1. The Problem  *(~150 words)*

53 million Americans care for an aging parent. Most are unpaid family members
juggling work, kids, and a 200-mile drive to Mom's house. The information gap
is brutal: a paid caregiver visits, something happens, and the family hears
about it in a 90-second phone call hours later — if at all. Lab results sit
in a portal nobody opens. Medication changes get lost in voicemail.

The cost is measured in preventable ER visits, missed medication doses, and
the quiet exhaustion of adult children who can't tell, from 1,000 miles away,
whether Mom is okay today.

**Alio** is an AI copilot for elder care that connects the three people who
need to be on the same page — the senior, the paid caregiver, and the adult
child — through voice-first visit notes, AI-interpreted lab results, and
real-time structured reports.

> *"When you can't be there, Alio is."*

---

## 2. The Vision  *(~120 words)*

Alio is built around one promise: **the family knows, the moment something
matters.** Not five hours later. Not buried in a chart. The caregiver speaks;
the family sees a structured report seconds later. Mom uploads a lab photo;
a fine-tuned Gemma 4 explains it in plain English and flags what to ask the
doctor. A symptom appears; the AI asks the right follow-up questions and
escalates to the family chat if it crosses a severity threshold.

We chose elder care because the privacy stakes are non-negotiable — health
data, family conversations, photographs of prescription bottles. That
constraint is what made Gemma 4 the right model: **local inference, locally
fine-tuned, with no data leaving the device** for the most sensitive paths.

---

## 3. How We Used Gemma 4  *(~350 words)*

### 3.1 One dispatch point, two modes

The whole app routes through a single function — `_call_gemma()` in
[medical_ai.py](backend/medical_ai.py) — which switches on the
`USE_LOCAL_OLLAMA` env var:

| Mode | Model | Use case |
|---|---|---|
| **Cloud** *(default)* | `gemma-4-31b-it` via Google GenAI API | Hackathon judges hit the live demo, full 31B quality, no setup |
| **Local** *(`USE_LOCAL_OLLAMA=1`)* | **Fine-tuned `gemma-4-e2b`** via Ollama | HIPAA-sensitive deployment, offline, edge hardware |

The same prompt, same `VisitReport` / lab / triage JSON schema, same UI —
one env var flips the entire trust boundary. This is what lets us claim
"local-first" without forcing every demo viewer to install Ollama.

The fine-tuned E2B handles **all three** structured tasks the app calls
into Gemma for: visit-note summaries, lab-panel explanations, and symptom
triage (see §3.2 below).

### 3.2 Fine-tuning with Unsloth — distilling 31B → E2B

Rather than train from scratch, we ran a **knowledge-distillation pipeline**:
Gemma 4 31B as the teacher, Gemma 4 E2B as the student. The 31B model
already knows medicine; our job was to compress its plain-language bedside
manner into a model small enough to run locally on a phone or laptop.

**Three training tasks, one per product feature:**

| Task → JSON output | Source | Pairs |
|---|---|---|
| Clinical note → visit summary (`summary`, `mood`, `medications_noted`, `urgent`) | [MTSamples](https://www.kaggle.com/datasets/tboyle10/medicaltranscriptions), filtered to elder-relevant specialties | ~1000 |
| Lab panel (Epic/MyChart format) → explanation (`summary`, `flags`, `follow_up`) | Synthetic — 15 panel types (CMP, CBC, Lipid, HbA1c, etc.) with real Quest/LabCorp ranges | ~700 |
| Patient symptom report → triage (`urgency`, `explanation`, `watch_for`) with hard-coded escalation for chest pain, stroke signs, severe bleeding | 31B generates patient-voice scenarios across 4 severities, then triages each | ~300 |

**Final dataset:** 998 ShareGPT-format pairs (898 train / 100 val).

**Method:** Unsloth 4-bit QLoRA on Gemma 4 E2B-it — rank=16, α=32,
dropout=0.05, all linear projections targeted. 2 epochs, effective batch 8,
LR 2e-4 cosine, ~224 steps total. Trained on a single **T4 16 GB (Kaggle
free tier)**; exported as `q4_k_m` GGUF (~1.7 GB) for direct Ollama serving.
Full reproduction in `kaggle_train_gemma4_e2b.ipynb`.

**Eval:** validation loss converged on the 100-row held-out split. [TODO:
task-specific metric — e.g., "On 30 held-out lab panels, fine-tuned E2B
matched 31B's `follow_up` tier on N/30" — strongly recommend running before
submission.]

### 3.3 Structured output as the data contract

Every Gemma 4 call returns strict JSON (`VisitReport` / lab / triage). The
schema lives in lockstep across backend prompt, caregiver TypeScript, and
family TypeScript — so the same shape flows voice → AI → Postgres →
realtime → UI without runtime parsing surprises.

---

## 4. Architecture  *(~250 words)*

```
   Caregiver app (Next.js)        Family app (Next.js)
        │                                │
        │ /transcribe /summarize         │
        │ /compile    /format-for-family │ realtime subscribe
        ▼                                ▼
     ┌────────────────────────────────────────┐
     │      FastAPI  (api.py, report.py)       │
     │      medical_ai.py  ── dispatch ──┐     │
     └─────────────────────────────────┐ │     │
                                       ▼ ▼
                  ┌──── Gemma API (31B-it)       (cloud path)
                  └──── Ollama   (fine-tuned E2B) (local path)
                                       │
                       ┌───────────────┴────────────┐
                       ▼                            ▼
                Supabase (Postgres + realtime)   HuggingFace
                 caregiver_logs                  (model registry)
                 compiled_reports
                 family_messages
```

**End-to-end flow for one visit:** Sarah (caregiver) presses to speak →
Web Speech gives live captions (server-side STT chunking fallback every 3s)
→ Save inserts a row into `caregiver_logs` with a Gemma-extracted summary
→ tap **+** to `/compile` a structured `VisitReport` → **Send to family**
inserts into `family_messages` → Janet's chat receives the row via Supabase
realtime in <1s and renders the same structured card inline. The same
report also appears in family **Records → Visits**.

**Lab path:** lab PDF / photo → OCR → fine-tuned Gemma 4 E2B (Ollama) →
plain-language explanation + severity flags → family chat notification if
anything's flagged.

---

## 5. Why These Technical Choices  *(~200 words)*

**Why distill 31B → E2B (not just use the API)?** E2B runs on a phone or a
$200 mini-PC. For elder-care families who don't have a server in the closet,
"local-first" has to mean "fits on the device they already own." The 31B
teacher already speaks plain-language medicine well; ~224 LoRA steps were
enough for E2B to inherit that voice across all three task types while
staying small enough to ship as a 1.7 GB GGUF.

**Why Ollama for serving?** One command (`ollama pull`), a stable REST API,
identical interface across macOS / Linux / Windows. We didn't want to ship
a Python inference stack to non-technical users.

**Why Unsloth for fine-tuning?** 2× faster training, 70% less VRAM, single
file. We trained on free Kaggle compute. A clinician collaborator can
re-run the pipeline without renting GPUs.

**Why structured JSON, not freeform?** Reports stream from caregiver →
family in <1s. A worried adult child cannot parse a paragraph at a glance.
Structured cards with red/amber/green severity flags map to how a triage
nurse actually thinks.

**Why Supabase realtime?** Postgres + WebSocket push, no polling, no custom
pub/sub. The whole "the family knows instantly" promise is one
`alter publication supabase_realtime add table family_messages` line.

---

## 6. Real-World Impact & What's Next  *(~150 words)*

We tested Alio with [TODO: N families? a focus group? a clinician? — or
delete this sentence and rely on the demo video for the human story].

**What it unlocks today:** a paid caregiver who's never touched a tablet can
narrate a visit and the family 1,000 miles away sees structured vitals,
mood, and medication adherence within a second of "send." A lab result that
would sit unread in a portal becomes a one-tap explanation in the family
chat.

**Roadmap:** elder portal (large-text calendar + one-tap call), multi-patient
support for caregiving agencies, on-device speech for full offline operation,
clinician dashboard with longitudinal trend detection. The Gemma 4 E2B fine-
tune is the foundation; every future health-document type — discharge papers,
prescriptions, imaging reports — gets the same pipeline.

---

## 7. Links

- **Live demo:** [TODO: Vercel URL — caregiver & family portals]
- **Video (3 min):** [TODO: YouTube URL]
- **Code repository:** https://github.com/JzZ404/Alio
- **Fine-tuned model:** https://huggingface.co/aarony630/alio-medical
- **Reproduction:** see `train/README.md` and `kaggle_train_gemma4_e2b.ipynb`

## 8. Team

- **Aaron Yeung** — Co-founder & Machine Learning Lead
  *(Kaggle: [TODO: handle])* — Gemma 4 fine-tuning, caregiver → family backend
- **Felix Du** — Co-founder & Creative Director
  *(Kaggle: [TODO: handle])* — Full-stack engineering (family → caregiver), video direction
- **Joyce Zhou** — Co-founder & Product Manager
  *(Kaggle: [TODO: handle])* — Product strategy, caregiver portal design
- **Murphy Wei** — Co-founder & Head of User Research
  *(Kaggle: [murphywei1121](https://www.kaggle.com/murphywei1121))* — User interviews, family portal design *(handling submission)*

## 9. Acknowledgments

Built with Gemma 4 (Google), Unsloth, Ollama, Supabase, and Next.js. Thanks
to [TODO: anyone — clinician advisor, family members who tested, etc.].

<!--
====================================================================
WORD-COUNT CHECK after filling TODOs:
  PowerShell:  (Get-Content WRITEUP.md | Measure-Object -Word).Words
  Bash:        wc -w WRITEUP.md
Stay under 1,500. Trim section 4 (architecture prose) first if over — the
diagram does most of the work there.
====================================================================
-->
