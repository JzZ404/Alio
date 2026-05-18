# Alio: When You Can't Be There

> Submission for **The Gemma 4 Good Hackathon**
> Track: **Impact: Health & Sciences** *(also being evaluated for Main Track, Ollama Special Prize, Unsloth Special Prize)*

---

## Motivation

A year ago, our teammate Murphy's grandmother fainted alone in her bathroom with a dangerously high fever. A caregiver had been with her that day, but the update she sent the family was vague and missing any real sense of urgency. Nobody saw what was coming. By the time the family understood how serious things were, her grandmother had already collapsed with no one there to help her.

She was rushed to the ICU. Murphy's father was told to prepare for the worst. She recovered, but the whole family was shaken, not by how serious it got, but by how preventable it was. The caregiver had seen the signs. The information was there. It just never reached the family in a way they could act on.

That is the gap Alio was built to close. Millions of elderly adults live alone, with a caregiver visiting a few hours a day while their adult children manage everything from another city. The caregiver sees how the elder ate, moved, and felt, but that information rarely makes it past a quick text. Flags go unraised. Families find out too late.

## The Problem

The breakdown in elder care communication is structural, not accidental. Caregivers are trained professionals, but after a long visit their update is whatever they happen to remember. There is no structured format, no required fields, nothing prompting them to flag what changed. Remote family members rely on secondhand updates and have no way to know what they are missing.

Serious health events rarely happen without warning. A few days of low appetite, a slight change in how someone walks, a fever that has not broken. These signals exist; they disappear before anyone connects the dots.

## Solution

Alio connects two people: the in-home caregiver and the remote adult child. After a visit, the caregiver records a short voice note. Alio transcribes it, structures it into a visit report, checks it against the elder's medical history, and sends a clean summary to the family automatically. The caregiver does not have to write anything.

The adult child opens the app from wherever they are and sees everything: every visit, every medication update, every flag. They can upload medical records, manage appointments, and ask the AI questions about their parent's health using the full history as context.

One visit. Two people informed. Nothing dropped.

## How We Used Gemma 4

Elder care is one of the worst domains for sending raw data to a third-party AI provider: voice transcripts about vitals, photos of prescription bottles, 2am conversations about a parent's chest pain.

Our answer was **local-first AI**. Heavy inference on raw inputs runs through our fine-tuned Gemma 4 E2B served via Ollama, so the raw audio, prescription photo, and lab printout never cross the wire to a third-party AI provider. Only the structured outputs (BP numbers, severity flags, short summaries) sync to Postgres so the whole family sees the same report at the same time. Signal extraction stays local; structured rows move between devices.

We built four core features on this foundation.

**Voice visit transcription and structuring.** The caregiver records a voice note. Web Speech provides live captions, with a Google STT fallback. The transcript goes to our fine-tuned E2B model, which extracts a structured visit report (observations, medications taken or missed, mood, flags), stored in Supabase and pushed to the family in real time.

**Symptom check against full medical history.** Gemma 4 compares today's observations against the elder's complete history (past visits, diagnoses, current medications, allergies) using its 256K context. If something looks off, it surfaces a flag. A pattern like Murphy's grandmother's (fever plus reduced activity) would have triggered an alert before things got critical.

**Medical record extraction.** Family members upload PDFs, prescription photos, or discharge summaries. Gemma 4's vision returns a plain-language explanation with a severity flag and a follow-up tier (routine, soon, urgent). The summary goes straight into the family chat.

**Family health Q&A.** The adult child asks questions directly. Gemma 4 answers using full context and cites the source for each answer. Any clinical response includes a reminder to consult a doctor. With local inference enabled, the conversation stays on the family's own hardware.

## Architecture

Pipeline: caregiver records a voice note, Google STT transcribes it, our fine-tuned Gemma 4 E2B structures and analyzes it via Ollama, the result lands in Supabase, and the family view updates via Supabase Realtime in under a second.

We dispatch per endpoint based on what the fine-tuned student was trained for: structured paths (visit compilation, lab interpretation) go local; freeform paraphrase goes to hosted Gemma 4 31B, since the smaller model was not distilled on those prompts.

Stack: Next.js frontend (`/caregiver` and `/family`), FastAPI backend, Supabase, Gemma 4 E2B via Ollama, hosted Gemma 4 31B as fallback, Vercel.

## Fine-Tuning with Unsloth

We ran a knowledge distillation pipeline with Gemma 4 31B as the teacher and Gemma 4 E2B as the student, on three tasks: clinical notes to visit summaries, lab panels to plain-language explanations with severity flags, and symptom reports to triage assessments. The final dataset was 998 pairs, trained with Unsloth 4-bit QLoRA on a single Kaggle T4 free tier. The exported model is a 3.4 GB Q4_K_M GGUF at [kaggle.com/models/matong666/alio-medical](https://www.kaggle.com/models/matong666/alio-medical), mirrored on HuggingFace at [aarony630/alio-medical](https://huggingface.co/aarony630/alio-medical) for direct Ollama installation.

## Challenges

**Designing for clarity under stress.** Presenting medical records, visit logs, medications, and flags without overwhelming a family member checking at night took heavy iteration on information hierarchy: critical flags at the top, detail available on demand.

**Structuring informal caregiver speech.** Caregivers do not talk clinically. A note might sound like "she seemed off today, didn't really eat, I think she took her pills." Getting Gemma 4 to extract reliable structured data from that input required significant prompt iteration.

**Responsible AI.** The caregiver reviews every AI note before it sends. Gemma 4 never diagnoses, only raises flags. Every Q&A response includes a reminder to consult the elder's doctor.

## Impact

There are 53 million unpaid family caregivers in the United States, and the number of elderly adults living alone with professional in-home care grows every year. What happened to Murphy's grandmother is common. The information exists; the system does not move it to the right people in time.

Alio turns what a caregiver already knows into something a remote family can see and act on. Murphy's grandmother recovered. Not every family is that lucky.

## What's Next

Multilingual support so caregivers can record in their native language. Integration with Epic and MyChart. An elder-facing tablet with large-text reminders and one-tap family calling. Fully offline operation with on-device speech-to-text, so no audio ever needs the network.

## Technical Verification

For the Unsloth and Ollama special prizes, here is how to verify every claim above in under 10 minutes.

### Verify the Unsloth fine-tune

1. Open the reproduction notebook [`kaggle_train_gemma4_e2b.ipynb`](train/kaggle_train_gemma4_e2b.ipynb), which runs natively on a Kaggle T4 free tier. Cell outputs are preserved so the validation loss curve and sample completions are visible without re-running.
2. Inspect the training data: [`train/data/train.jsonl`](train/data/train.jsonl) (898 pairs) and [`train/data/val.jsonl`](train/data/val.jsonl) (100 pairs), ShareGPT format.
3. Inspect the training config in [`train/train_gemma4_e2b.py`](train/train_gemma4_e2b.py): Unsloth `FastModel.from_pretrained`, 4-bit QLoRA, rank=16, α=32, dropout=0.05, all linear projections targeted, 2 epochs, effective batch 8, LR 2e-4 cosine, ~224 steps.
4. Pull the published artifact: Q4_K_M GGUF (3.4 GB) at [kaggle.com/models/matong666/alio-medical](https://www.kaggle.com/models/matong666/alio-medical) (canonical) and [huggingface.co/aarony630/alio-medical](https://huggingface.co/aarony630/alio-medical) (Ollama-pullable mirror).

### Verify the Ollama integration

1. Install Ollama ([ollama.com](https://ollama.com)) and pull the model: `ollama pull hf.co/aarony630/alio-medical:Q4_K_M` (~3 min).
2. Tail the Ollama server log so you can watch inference happen live (`~/.ollama/logs/server.log` on macOS/Linux, `$env:LOCALAPPDATA\Ollama\server.log` on Windows).
3. Trigger a structured-report call:
   ```
   curl -X POST http://localhost:8000/caregiver-logs/compile \
     -H "Content-Type: application/json" \
     -d '{"caregiver_id":"caregiver-001","patient_id":"erin-yeung","patient_name":"Erin Yeung"}'
   ```
4. The Ollama log will show `alio-medical` (not `gemma-4-31b-it`) handling the call. The response JSON matches `_STRUCTURED_REPORT_SYSTEM` in [`backend/medical_ai.py`](backend/medical_ai.py); `_call_gemma()` in the same file is the single dispatch function (controlled by `USE_LOCAL_OLLAMA` in `.env`).

## Links

- **Live demo:** [TODO: Vercel URL, caregiver & family portals]
- **Video (3 min):** [TODO: YouTube URL]
- **Code repository:** https://github.com/JzZ404/Alio
- **Fine-tuned model (canonical):** https://www.kaggle.com/models/matong666/alio-medical
- **Fine-tuned model (install mirror):** https://huggingface.co/aarony630/alio-medical
- **Reproduction:** [`train/kaggle_train_gemma4_e2b.ipynb`](train/kaggle_train_gemma4_e2b.ipynb)

## Team

- **Aaron Yeung**, Co-founder & Machine Learning Lead. Kaggle: [matong666](https://www.kaggle.com/matong666). Gemma 4 fine-tuning, caregiver to family backend.
- **Felix Du**, Co-founder & Creative Director. Kaggle: [TODO: handle]. Full-stack engineering (family to caregiver), video direction.
- **Joyce Zhou**, Co-founder & Product Manager. Kaggle: [jiayiz54](https://www.kaggle.com/jiayiz54). Product strategy, caregiver portal design.
- **Murphy Wei**, Co-founder & Head of User Research. Kaggle: [murphywei1121](https://www.kaggle.com/murphywei1121). User interviews, family portal design, handling submission.

## Acknowledgments

Built with Gemma 4 (Google), Unsloth, Ollama, Supabase, and Next.js. Thanks to the UW Medicine nurse practitioner who shared two decades of frontline insight, and to the families who tested early prototypes.

---

*Alio. From Latin: "another," "elsewhere." When you can't be there, Alio is.*
