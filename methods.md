# Alio — Methods & Flow

> *Working document tracking what we built, why, and how. Doubles as raw material
> for the Kaggle Writeup (≤1500 words).*

**Project:** Alio — an offline-first caregiver/family app that turns messy nurse
notes, voice transcripts, and scanned lab reports into plain-language updates
families can read in 30 seconds.

**Hackathon:** [Gemma 4 Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon) — submission deadline **2026-05-18**.

---

## Problem

Caregivers (often non-clinical family or in-home aides) communicate patient
status to families through messy hand-written notes, ad-hoc texts, and voice
recordings. Families don't understand the medical jargon. Clinical lab portals
(MyChart, Epic) dump raw values with no interpretation. The gap between
*data captured by caregivers* and *understanding by family* is wide, and it's
worse in environments where internet access is poor or HIPAA-sensitive data
shouldn't leave the building.

## Vision

A locally-runnable assistant that:

1. Ingests nurse voice notes, typed shift logs, and scanned lab reports
2. Outputs structured + plain-language summaries (vitals, mood, medications, flags)
3. Triages symptoms ("self_care" / "this_week" / "today" / "emergency")
4. **Runs entirely offline** on a regular desktop or clinic laptop — no PHI leaves the device

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Caregiver phone / clinic laptop                                │
│                                                                  │
│   nurse voice  ──►  Whisper (local)  ──►  transcript ─┐         │
│   typed notes ──────────────────────────────────────► │         │
│   scanned PDF ──►  Gemma 4 multimodal (vision) ────►  │         │
│                                                       ▼         │
│                                              ┌──────────────┐   │
│                                              │  Gemma 4 E2B │   │
│                                              │  fine-tuned  │   │  ← Ollama
│                                              │  on medical  │   │     locally
│                                              │  simpli + lab│   │
│                                              │  + triage    │   │
│                                              └──────┬───────┘   │
│                                                     │           │
│                              ┌──────────────────────┼────────┐  │
│                              ▼                      ▼        ▼  │
│                          structured            family chat   triage
│                          report (JSON)         message      urgency
│                          → Supabase            → Supabase   → app UI
└─────────────────────────────────────────────────────────────────┘
```

**Single dispatch point — [medical_ai.py:_call_gemma()](medical_ai.py)** routes
between hosted Gemma 4 31B (cloud) and local fine-tuned Gemma 4 E2B (via Ollama)
based on `USE_LOCAL_OLLAMA` env var. Lets us flip between cloud baseline and
local demo with one variable, and keeps the rest of the app unchanged.

---

## Data Pipeline

### 1 — Teacher-student data generation

We don't fine-tune Gemma 4 E2B from scratch — we use hosted **Gemma 4 31B as the
teacher** to label inputs, then train E2B (the **student**) to imitate it.
Cheaper, faster, and produces task-specific data matching the exact JSON schemas
the app consumes.

[build_training_data.py](build_training_data.py) generates the dataset from three sources:

| Source | Input | Output | Pairs |
|---|---|---|---|
| **Kaggle Medical Transcriptions** ([tboyle10/medicaltranscriptions](https://www.kaggle.com/datasets/tboyle10/medicaltranscriptions)) | Real clinical notes filtered to general/internal medicine + cardiology + neurology | Plain-language family summary (JSON: `summary`, `mood`, `medications_noted`, `urgent`) | ~280 |
| **Synthetic lab panels** | 15 panel types (CMP, CBC, Lipid, A1c, Iron, Vit D, B12, TSH, etc.) with realistic value distributions in MyChart/Epic format | Plain-language interpretation (JSON: `summary`, `flags`, `follow_up`) | ~700 |
| **Synthetic symptom triage** | 1-3 sentence patient/caregiver complaints generated in batches of 20, balanced across severities | Triage JSON (`urgency`, `explanation`, `watch_for`) | ~18 |

**Total: 998 training pairs → 898 train / 100 val.**

### 2 — Implementation details

- **Parallelism:** `ThreadPoolExecutor` with 16 workers + a global token-bucket
  rate limiter (300 RPM on paid tier)
- **Resumable:** Content-based checkpoint (`data/build_checkpoint.jsonl`); dedup
  by user-message text, *not* by `hash()` (Python's hash is randomized per
  process — burned us once)
- **Format:** ShareGPT-style chat conversations (`system` / `human` / `gpt` roles)
  for Unsloth's `apply_chat_template`

### 3 — Data sources rationale

The Kaggle dataset gives us *real* clinical phrasing (the input distribution we
care about). The synthetic lab panels let us cover the **8 panels the average
US older adult gets annually** ([UHC reference](https://www.uhc.com/news-articles/medicare-articles/8-medical-tests-every-older-adult-should-take))
without using real PHI. Synthetic triage covers severities uniformly — public
triage datasets skew toward emergencies.

---

## Fine-Tuning

### Stack

| Component | Version | Why |
|---|---|---|
| Base model | `unsloth/gemma-4-E2B-it` (5.15B params) | Smallest production Gemma 4 — fits in 12 GB VRAM, fast inference, "edge" pitch |
| Trainer | **Unsloth** + TRL `SFTTrainer` | Special Technology Track prize ($10K); 2× faster than vanilla |
| Adapter | **LoRA** (r=16, α=32, dropout=0.05) | Trains 31M / 5.15B params = 0.60% — small adapter, no catastrophic forgetting |
| Target modules | All attention + MLP (`q,k,v,o,gate,up,down`) | Maximum coverage with small param budget |
| Compute | Kaggle T4 (16 GB, free) | Local Windows install hit unresolvable dep conflicts; Kaggle's curated env is the canonical Unsloth path |
| Hyperparams | 2 epochs · batch 2 · grad-accum 4 (eff. 8) · lr 2e-4 cosine | Conservative, standard |

### Why Kaggle, not local 4070 Super?

Spent ~3 hours trying to make Unsloth work on Windows native Python 3.11.
Combinations attempted: `transformers 4.46/4.55/5.5` × `peft 0.19/main` ×
`torch 2.5/2.6/2.10/2.12` × `torchao 0.7/latest`. Each pin combination revealed
another removed API or missing-symbol mismatch. Kaggle pre-bakes a compatible
stack. The 4070 still does what matters — **inference for the demo** — via
Ollama, which has no training-stack dependencies.

### Quantization strategy

- **Training:** 4-bit (BnB) load via `load_in_4bit=True` to fit T4 VRAM
- **Export:** Saved as `q4_k_m` GGUF (~1.5 GB) → portable to any llama.cpp runtime
- **Inference:** Ollama loads the GGUF; runs comfortably on 4070's 12 GB

---

## Training Methods (Writeup Block)

This project does not use traditional ML methods (CNN, XGBoost, etc.). It is an
LLM fine-tuning project, so the methods are:

1. **Supervised Fine-Tuning (SFT)** of a pre-trained large language model —
   Google Gemma 4 E2B (~5.15B params, "edge" tier). Loss: cross-entropy on
   next-token prediction over instruction → output pairs in ShareGPT format.

2. **Low-Rank Adaptation (LoRA)** — rather than updating all model parameters,
   we train small low-rank adapter matrices (r=16, α=32, dropout=0.05) on the
   attention and MLP projection layers (`q,k,v,o,gate,up,down`). Trainable
   params: 31M / 5.15B = **0.60%** of the model. Avoids catastrophic forgetting
   and keeps the adapter portable.

3. **4-bit Quantization (QLoRA-style)** — frozen base weights loaded in 4-bit
   via bitsandbytes (`load_in_4bit=True`); LoRA adapters trained in bf16. Lets
   the 5B-param model train inside a 16 GB Kaggle T4.

4. **Unsloth acceleration** — custom CUDA kernels and gradient checkpointing
   approximately double throughput vs. vanilla HuggingFace PEFT. Eligible for
   the Unsloth Special Technology Track.

5. **Knowledge Distillation (data side)** — training labels were generated by
   **Gemma 4 31B** (teacher, via Google GenAI API). The student (Gemma 4 E2B)
   learns to imitate the teacher's plain-language medical explanations. Same
   model family on both ends.

**Training compute:** Kaggle T4 (16 GB, free tier) — local Windows + Microsoft
Store Python made the Unsloth dependency stack uninstallable after 3 hours of
attempts; Kaggle's curated ML environment is the canonical Unsloth path.

**Inference compute:** Local NVIDIA RTX 4070 Super (12 GB) running the GGUF
(`q4_k_m`, ~1.5 GB) via Ollama — no training-stack deps required for inference.

**Hyperparameters:** 2 epochs · batch 2 · grad-accum 4 (effective batch 8) ·
learning rate 2e-4 · cosine schedule · 5% warmup.

**Framework stack:** Unsloth + PEFT + TRL (`SFTTrainer`) + bitsandbytes on
PyTorch 2.6 / CUDA 12.4.

---

## Inference & Deployment

### Local-first via Ollama

After training, the LoRA adapter is exported to GGUF (`q4_k_m` quantization)
and packaged as an Ollama model:

```powershell
ollama create alio-medical -f Modelfile
ollama run alio-medical
```

[medical_ai.py](medical_ai.py) routes all four AI call sites
(`triage_conversation`, `explain_report_question`, `compile_caregiver_logs`,
`compile_structured_report`) through a single `_call_gemma()` dispatcher:

```bash
# Default: hosted Gemma 4 31B (high quality, requires internet)
python app.py

# Local fine-tuned mode (demo / production)
$env:USE_LOCAL_OLLAMA=1
$env:OLLAMA_MODEL=alio-medical
python app.py
```

**Verified end-to-end during development** — flipped the env var while data gen
was still running; `compile_caregiver_logs` produced a sensible plain-language
summary entirely from local Ollama (we used `gemma3:1b` as a placeholder until
the fine-tuned E2B was ready).

### Frontend

Next.js app under [nextjs/next-app/](nextjs/next-app/) — caregiver UI for voice
logging, family chat for receiving compiled reports, symptom-check UI for triage.
Supabase backs the data layer (`caregiver_logs`, `family_messages`,
`compiled_reports` tables). API server in [nextjs/api.py](nextjs/api.py) (FastAPI).

---

## Decisions Log

| Decision | Why | When |
|---|---|---|
| Use Gemma 4 E2B not E4B/12B | Edge story + fits 4070 12GB; "runs on a regular laptop" pitch | Day 1 |
| Teacher-student via 31B | Best quality teacher → smaller student inherits the wisdom | Day 1 |
| Synthetic labs vs real Kaggle lab dataset | Found Kaggle lab dataset was 27 rows of Turkish text; synthetic gives full control over format + coverage | Day 1 |
| Upgrade Gemini API to paid | Free tier 15 RPM was too slow; paid tier ~$1 total cost | Day 1 (after free-tier wall) |
| Pivot training to Kaggle | Local Windows + Microsoft Store Python made Unsloth uninstallable | Day 1 (after 3 hr dep hell) |
| Single env-var dispatch (`USE_LOCAL_OLLAMA`) | Demo can show both cloud and local paths from same code | Day 1 |
| Content-based checkpoint dedup | `hash()` randomization burned us — re-generated duplicates across restarts | Day 1 |

---

## Hackathon Track Alignment

| Track | Pool | Fit | Pitch |
|---|---|---|---|
| **Main Track** | $100K | ✅ | Real-world health problem, complete demo, novel architecture |
| **Health & Sciences Impact** | $10K | ✅✅ | "Bridge the gap between humans and data" — literal mission |
| **Ollama Special Tech** | $10K | ✅✅ | Local-first via Ollama with `USE_LOCAL_OLLAMA` dispatch; offline demo |
| **Unsloth Special Tech** | $10K | ✅✅ | Fine-tuned Gemma 4 E2B via Unsloth on Kaggle |
| **llama.cpp Special Tech** | $10K | ✅ | GGUF export via llama.cpp quantization (`q4_k_m`) for resource-constrained hardware |

---

## Stack Reference

```
Data gen   : Python 3.11 · google-genai (paid Gemini API) · pandas
Training   : Kaggle T4 · Unsloth 2026.5.2 · transformers 5.5 · trl 0.24 · peft 0.19
Inference  : Ollama (local 4070 Super) · GGUF q4_k_m
Backend    : FastAPI · Supabase (Postgres + LISTEN/NOTIFY realtime)
Frontend   : Next.js 14 · TypeScript
Voice      : speech_recognition (Google API today, faster-whisper for offline)
```

---

## Reproducing the Pipeline

### Quick start — just pull the published model

The trained model is published at **[huggingface.co/aarony630/alio-medical](https://huggingface.co/aarony630/alio-medical)**:

```bash
# 1. Install Ollama (https://ollama.com/download)
# 2. Pull the fine-tuned model in one command
ollama pull hf.co/aarony630/alio-medical

# 3. Tell the app to use it
$env:USE_LOCAL_OLLAMA="1"
$env:OLLAMA_MODEL="hf.co/aarony630/alio-medical"
```

That's the full reproduction path for inference — works on any machine with a
modern GPU (the model is 3.4 GB q4_k_m GGUF, fits in 4 GB VRAM).

### Full pipeline (training from scratch, for transparency)

1. `python build_training_data.py` — needs `GOOGLE_API_KEY` and Kaggle medical transcriptions dataset → produces `data/train.jsonl` + `data/val.jsonl`
2. Upload JSONLs as Kaggle dataset; open [kaggle_train_gemma4_e2b.ipynb](kaggle_train_gemma4_e2b.ipynb); run all
3. Download GGUF + Modelfile from the Kaggle notebook's output
4. `ollama create alio-medical -f Modelfile` (or push to HF: `python scripts/publish_to_hf.py`)
5. `$env:USE_LOCAL_OLLAMA=1; $env:OLLAMA_MODEL=alio-medical; python -m uvicorn api:app` — app now runs offline against the fine-tuned model

---

## Known Limitations / Future Work

- Multimodal (vision/audio) towers of Gemma 4 E2B aren't fine-tuned — only the text head. Image lab-report ingestion uses the *base* Gemma 4's vision capability, then routes text through the fine-tuned head.
- Triage dataset is small (~18 pairs after dedup) due to API hiccups during synthetic generation; could expand to ~300 with another data-gen pass.
- No RLHF / DPO step — single-stage SFT only.
