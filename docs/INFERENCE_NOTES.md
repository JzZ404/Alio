# Inference Setup Notes

Snapshot of what's running where, what's fast vs reliable, and the GPU
exploration that took us to today's split. Useful for the WRITEUP and for
porting to a different machine.

## Current dispatch

| Endpoint | Backend | Model | Latency (warm) | Why |
|---|---|---|---|---|
| `/summarize` (per-note AI card) | Hosted Google GenAI | `gemma-4-31b-it` | ~17s | Fine-tuned E2B hallucinates on freeform single-note summaries — the 31B teacher is reliable. |
| `/compile` (structured visit report) | Local **Ollama, CPU** | **`alio-medical`** (Unsloth-distilled Gemma 4 E2B Q4_K_M) | ~15s | The fine-tune was trained on this exact structured schema; output is correct. We use **only the latest log** per compile to keep the prompt inside the model's context window. |
| `/children/chat` (family AI) | Hosted Google GenAI | `gemma-4-31b-it` | varies | Conversational, freeform. |
| `/transcribe` (audio → text) | Google STT (via `speech_recognition`) | — | ~1s | Server-side fallback when Web Speech fails. |

`USE_LOCAL_OLLAMA=1` in `.env` enables the local Ollama path for
`compile_structured_report`. `summarize_report` bypasses the dispatch and
always hits hosted (see `backend/report.py` for the rationale comment).

## Machine snapshot — Windows + Intel Arc 140V iGPU

| Run mode | Compile latency | Output quality | Notes |
|---|---|---|---|
| Hosted gemma-4-31b-it | ~19s | ✅ correct | network round-trip + 31B inference |
| Local Ollama, **CPU** | ~15s warm, ~35s cold | ✅ correct | what we're shipping on this box |
| Local Ollama, **Vulkan on Intel Arc** | ~3s warm | ❌ garbage (Thai text, hallucinated vitals, `{"A":"string", "B":"string"}` shapes) | fast but unusable |

### Why Vulkan failed on Intel Arc

- Ollama's Vulkan backend (`ggml-vulkan.dll`) is the newest of its three GPU
  paths (CUDA, Metal, Vulkan). Intel Arc is the newest target for that
  backend — least battle-tested combination.
- The Arc 140V iGPU reports `bf16: 0` (no BF16). Kernels fall back to FP16/FP32
  paths that aren't all numerically equivalent on Intel hardware.
- Q4_K_M dequantization on the Vulkan kernels appears to drift just enough
  to push the model out of its training distribution, so it samples
  off-manifold tokens.
- Symptom: model loads fully into VRAM (`offloaded 36/36 layers to GPU`),
  generates fast, but emits coherent-looking nonsense (e.g. wrong vitals,
  refusal responses to valid inputs, Thai-language output to English prompts).
- Disabling Vulkan (`OLLAMA_VULKAN=false`) restores correct output by routing
  through the CPU path (`ggml-cpu-alderlake.dll`).

`OLLAMA_VULKAN=false` is set as a Windows User env var so this preference
survives reboots; the Ollama system-tray app picks it up on next launch.

## Plan for Mac Pro M4

Apple Silicon + Metal is the second-most-mature Ollama path (after CUDA),
and well-tested for quantized Gemma. Expected on M4 Pro for the same
`alio-medical` Q4_K_M:

- `/compile`: **~1–3s warm** (vs 15s CPU on Windows, vs 3s broken on Arc)
- Correct output (Metal kernels for Q4_K_M are widely used)
- No `OLLAMA_VULKAN` flag needed — Metal is the default backend

Migration steps:

```bash
# 1. Install Ollama
brew install --cask ollama

# 2. Pull / create the fine-tuned model
#    Canonical release: https://www.kaggle.com/models/matong666/alio-medical
#    HuggingFace mirror is what `ollama pull` actually consumes:
ollama pull hf.co/aarony630/alio-medical:Q4_K_M
# If that errors on import (HF's Modelfile uses a relative FROM path), do:
#   ollama create alio-medical -f backend/Modelfile.alio-medical
# but first edit Modelfile.alio-medical to point FROM at the absolute blob
# path on macOS:  ~/.ollama/models/blobs/sha256-<hash>

# 3. Clone + start backend
git clone <this repo>
cd Gemma/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api:app --port 8000

# 4. Frontend (separate terminal)
cd ..
pnpm install
pnpm dev:caregiver   # 3001
pnpm dev:family      # 3002
```

`.env` is the same as on Windows — keep `USE_LOCAL_OLLAMA=1` and
`OLLAMA_MODEL=alio-medical`.

## Why this story is actually a strength

The split (fine-tuned E2B handles structured tasks locally, 31B teacher
handles freeform) is a more honest and defensible architecture than
"everything on E2B" — it's a real distillation-deployment tradeoff that
shows engineering judgment. The WRITEUP §3.2 framing should reflect that:

> The fine-tuned E2B excels on the structured-report task it was trained
> on (visit reports, lab interpretation, triage). For freeform paraphrasing
> we fall back to the 31B teacher. This keeps the most sensitive,
> high-frequency call path local and the rare, freeform path hosted.
