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

## 1. The Problem  *(~270 words)*

This project began with a personal crisis. One of our teammates received the
call no family wants — her 90-year-old grandmother, who lived alone with the
support of a daily caregiver, had collapsed at home and been rushed to the
ICU. What made it devastating wasn't the event itself, but what came after:
the warning signs had been there for days. The caregiver had noticed changes,
mentioned them in passing, sent updates through WhatsApp messages and
handwritten notes. Those updates were scattered across chat threads, buried
beneath work emails and everyday noise, and only ever reached one family
member — who, like most adult children caring for aging parents, was already
stretched thin.

Nobody had failed on purpose. The caregiver had done her job. The family
cared deeply. The problem was structural: there was no system connecting the
people who showed up every day with the people who loved her from afar.
Across millions of households, elderly care is held together by fragmented
communication — informal messages, memory, and luck. Critical health signals
routinely slip through the cracks, and families often only learn how serious
things are when it's already too late.

That gap became our starting point. **Alio** is the platform we built to
close it — an AI copilot for elder care that connects the three people who
need to be on the same page: the senior, the paid caregiver, and the adult
child. Voice-first visit notes, AI-interpreted lab results, real-time
structured reports — so every family member stays in the loop, not just one.

> *"So no one cares alone."*

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

## 3. How We Used Gemma 4  *(~650 words)*

### 3.0 The constraint that shaped every technical choice

Elder care is one of the worst possible domains for "ship your data to a
cloud API and hope for the best." Every Alio call touches something a HIPAA
covered entity would refuse to hand to a third party:

- A caregiver's voice notes describing a patient's vitals, mood, and missed
  meds.
- Photos of prescription bottles, lab printouts, AVS summaries from a
  recent ER visit.
- Family chat threads about a parent's symptoms, falls, mental state.
- The transcript of a 2 a.m. AI conversation a worried adult child has
  about whether their mom's new chest pain is dangerous.

For Alio to be a real product — not just a hackathon demo — the most
sensitive call paths have to run on the family's own hardware. The senior's
iPad. The caregiver's phone. A $200 mini-PC in the kitchen. That's a hard
constraint, and it forced three technical decisions before we wrote a line
of model code:

**1. The model has to fit on consumer hardware.** Gemma 4 31B is excellent,
but no one is running it on Grandma's tablet. We needed something in the
2–5 B-param range that still spoke plain-language medicine. **That's why
we distilled to Gemma 4 E2B (4.6 B params, Q4_K_M, 3.4 GB GGUF)** — small
enough to run on Apple Silicon or a CPU, big enough to inherit the
teacher's voice on the tasks we trained for (§3.2).

**2. We had to fine-tune on free compute.** Renting H100s for distillation
makes the pipeline reproducible by exactly one team. **That's why we used
Unsloth** — 4-bit QLoRA fits in 16 GB VRAM, so the whole pipeline runs on
a single Kaggle T4 (free tier). Any clinician collaborator with a Google
account can re-run our 2-epoch, 224-step training notebook without renting
GPUs. The model on HuggingFace
([aarony630/alio-medical](https://huggingface.co/aarony630/alio-medical))
is just the artifact of a reproducible pipeline, not a one-off.

**3. The serving stack has to be deployable by non-engineers.** A caregiver
should not need to install CUDA drivers, configure a Python venv, or
download a model from HuggingFace by hand. **That's why we used Ollama** —
one command (`ollama pull`), one daemon, a stable REST API identical across
macOS / Linux / Windows. A family member who can install Slack can install
Alio.

Together those three choices — **Unsloth fine-tuning, Ollama serving,
a 4.6 B Q4_K_M student model** — are what let us claim "local-first" with a
straight face. Without them, Alio would be a thin wrapper around a cloud
API, and the privacy promise in §2 would be marketing copy.

The rest of §3 explains how those decisions show up in the code: what the
dispatch looks like at request time (§3.1), what the distillation pipeline
actually trained the student on (§3.2), and how strict JSON keeps the
caregiver and family UIs in lockstep with the model (§3.3).

### 3.1 Per-task dispatch — local for what we distilled for, hosted for what we didn't

Every Gemma 4 call goes through a single function —
`_call_gemma(system, user, json_mode)` in
[medical_ai.py](backend/medical_ai.py) — that switches on the
`USE_LOCAL_OLLAMA` env var:

| `USE_LOCAL_OLLAMA` | Backend | Model served |
|---|---|---|
| `0` *(default — judges-friendly)* | Google GenAI API | `gemma-4-31b-it` |
| `1` *(local-first deployment)* | Local Ollama daemon | **fine-tuned `alio-medical`** — Gemma 4 E2B, Q4_K_M GGUF, ~3.4 GB |

But the actual production split is **per-endpoint**, not per-deployment:

| Endpoint | Backend | Why |
|---|---|---|
| `/caregiver-logs/compile` (structured `VisitReport`) | **local alio-medical** | Distilled on this exact JSON shape — output is reliable, fast on-device, never leaves the box. |
| `/labs/interpret` (lab panel → explanation + severity flags) | **local alio-medical** | One of the three distillation tasks — same story. |
| `/children/chat` (family conversational AI) | local **alio-medical** when env set, else hosted | Conversational. |
| `/summarize` (per-note freeform paraphrase) | **hosted gemma-4-31b-it** | E2B was *not* distilled on freeform single-note summaries — empirically hallucinates here. The 31B teacher is reliable, so we always pay the round-trip. |
| `/transcribe` (audio → text) | Google Speech-to-Text | Server fallback when the browser's Web Speech API errors out. |

**The design lesson we learned during integration:** a distilled student
inherits the teacher's capability *only on the tasks it was trained for*.
The split isn't a compromise — it's the honest deployment of a 4.6 B-param
model: keep it on its strengths, fall back to the teacher when
off-distribution. The high-frequency, privacy-sensitive paths
(`/compile`, `/labs`) stay on-device; the rare, low-stakes freeform path is
allowed to leave. This is what lets us claim "local-first" without
overpromising.

The data contract — strict JSON schemas defined in
`_STRUCTURED_REPORT_SYSTEM` and `_LAB_SYSTEM` — is identical across modes,
so the caregiver / family TypeScript renders the same UI either way.

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

**Eval:** validation loss converged on the 100-row held-out split. In
integration, the fine-tune matched the teacher tightly on the **structured**
tasks it was trained for — `VisitReport` shape compliance is ~100 % on
manual spot checks (BP, pulse, temp, flag severity all populated correctly
from a single morning-check log). On **freeform** paraphrase prompts it
wasn't trained for, output drifts hard (hallucinated vitals, occasional
non-English tokens) — which is the empirical evidence behind the per-task
split in §3.1, and why `/summarize` always goes to the 31B teacher.
*[TODO before submission: report N/30 schema-match rate on the 100-row
held-out split.]*

### 3.3 Structured output as the data contract

Every Gemma 4 call returns strict JSON (`VisitReport` / lab / triage). The
schema lives in lockstep across backend prompt, caregiver TypeScript, and
family TypeScript — so the same shape flows voice → AI → Postgres →
realtime → UI without runtime parsing surprises.

---

## 4. Architecture  *(~400 words)*

```
   Caregiver app (Next.js, port 3001)            Family app (Next.js, port 3002)
         │                                              │
         │ /transcribe  /summarize                      │
         │ /compile     /caregiver-logs/...             │ realtime subscribe
         │ /labs/interpret                              │ /children/chat
         ▼                                              ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                  FastAPI  (backend/api.py)                       │
   │                                                                  │
   │   medical_ai.py  ─── _call_gemma() ───┐                          │
   │   report.py      ─── hosted only ───┐ │                          │
   │   children/chat  ─── _call_gemma() ─┤ │                          │
   │                                     │ │                          │
   └─────────────────────────────────────┼─┼──────────────────────────┘
                                         │ │
                  ┌──────────────────────┘ └────────────────────┐
                  ▼                                             ▼
        Hosted Google GenAI                         Local Ollama (CPU / GPU)
        gemma-4-31b-it                              alio-medical (E2B Q4_K_M)
        - /summarize  (freeform)                    - /compile           (structured)
        - /children/chat (cloud fallback)           - /labs/interpret    (structured)
                                                    - /children/chat     (when set)
                  │                                             │
                  └──────────────────┬──────────────────────────┘
                                     ▼
                   ┌─────────────────────────────────────┐
                   │ Supabase (Postgres + realtime push) │
                   │   caregiver_logs                    │
                   │   compiled_reports                  │
                   │   family_messages                   │
                   │   lab_reports                       │
                   └─────────────────────────────────────┘
                                     │
                                     ▼
                          HuggingFace model registry
                          (aarony630/alio-medical, Q4_K_M GGUF)
```

**End-to-end flow for one visit.** Sarah (caregiver) taps **Press to Speak** →
Web Speech API gives live word-by-word captions in the browser; in parallel
`MediaRecorder` chunks every 3 s and POSTs to `/transcribe` (Google STT) so
no audio is lost if Web Speech errors out. She edits the transcript on the
**Review** screen, then **Save**. The frontend POSTs to `/summarize`, which
hits **hosted Gemma 31B** for a plain-language `VisitSummary {summary, mood,
medications_noted, urgent}` — the UI renders it as an inline card under the
audio bubble, and the row is persisted to `caregiver_logs`. Sarah taps **+**
to call `/caregiver-logs/compile`, which pulls the **latest** log for that
patient and sends it to **local Ollama** (`alio-medical`) for a strict
`VisitReport` JSON (vitals / mood / meds with severity flags). The compiled
row goes into `compiled_reports`; the chat picks up a tappable report card.
Sarah taps the card → **Log Summary** template → **Send to family** calls
`/caregiver-logs/report/format-for-family`, which inserts a row into
`family_messages`. Janet's family chat is subscribed to that table via
Supabase realtime — the message shows up in **<1 s** and the same structured
card appears in **Records → Visits**.

**Lab path.** Janet uploads a lab PDF/photo → `/labs/interpret` → server-side
OCR (Tesseract) → **local Ollama (`alio-medical`)** returns a plain-language
explanation + severity flags + `follow_up` tier → row in `lab_reports` →
family chat notification if anything's flagged.

**AI chat.** Janet asks the AI on the Family AI screen → `/children/chat`
routes through `_call_gemma()` (local if `USE_LOCAL_OLLAMA=1`, hosted
otherwise) → conversational reply streamed back into the chat bubble.

**Dispatch rationale (see §5).** `_call_gemma(system, user, json_mode)` is a
single function in `medical_ai.py` that switches on the `USE_LOCAL_OLLAMA`
env var. The split — local for structured tasks the fine-tune was distilled
on, hosted for freeform paraphrasing — is the engineering judgment that
keeps the high-frequency, privacy-sensitive call path on-device while
falling back to the 31B teacher for the rare cases where the small model
can't be trusted.

---

## 5. Why These Technical Choices  *(~280 words)*

**Why distill 31B → E2B (not just use the hosted API)?** E2B runs on a phone
or a $200 mini-PC. For elder-care families who don't have a server in the
closet, "local-first" has to mean "fits on the device they already own."
The 31B teacher already speaks plain-language medicine well; ~224 LoRA
steps were enough for E2B to inherit that voice on the **structured tasks
we trained for** (visit reports, lab interpretation, triage) and ship as a
3.4 GB Q4_K_M GGUF that loads in seconds on Apple Silicon or Intel CPUs.

**Why a per-endpoint dispatch instead of "everything on E2B"?** See §3.1 —
the distilled student is rock-solid on the JSON shapes it was trained on
and unreliable on freeform paraphrase prompts it wasn't. We took that
empirically and built a backend that routes each call to the model that
handles it well. It's a more honest story than "we fine-tuned for
everything and it all just works," and it keeps the privacy-critical path
(`/compile`, `/labs`) on-device where it belongs.

**Why Ollama for serving?** One command (`ollama pull`), a stable REST API,
identical interface across macOS / Linux / Windows. We didn't want to ship
a Python inference stack to non-technical users. (Caveat: Ollama's Vulkan
backend on Intel Arc iGPUs produces fast but numerically wrong tokens — we
ship on CPU on Windows, on Metal on Apple Silicon. Details in
`docs/INFERENCE_NOTES.md`.)

**Why Unsloth for fine-tuning?** 2× faster training, 70 % less VRAM, single
file. We trained on free Kaggle compute (T4 16 GB). A clinician
collaborator can re-run the pipeline without renting GPUs.

**Why structured JSON, not freeform?** Reports stream from caregiver →
family in <1 s. A worried adult child cannot parse a paragraph at a glance.
Structured cards with red/amber/green severity flags map to how a triage
nurse actually thinks — and they're what made the per-endpoint dispatch in
§3.1 possible in the first place (you can't dispatch by shape if there's
no shape).

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
