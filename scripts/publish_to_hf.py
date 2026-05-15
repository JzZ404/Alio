r"""
publish_to_hf.py
================
Publish the fine-tuned alio-medical Gemma 4 E2B to HuggingFace Hub so judges,
teammates, and new machines can pull it with one command.

Usage
-----
    # Set your HF Write token (https://huggingface.co/settings/tokens):
    $env:HF_TOKEN = "hf_..."

    # Optional: override the local file paths or the repo name
    $env:GGUF_PATH = "C:\Users\aaron\Downloads\gemma-4-e2b-it.Q4_K_M.gguf"
    $env:MODELFILE_PATH = "C:\Users\aaron\Downloads\Modelfile"
    $env:REPO_NAME = "alio-medical"

    python scripts/publish_to_hf.py

What it does
------------
1. Reads HF_TOKEN, logs in, fetches your username from /whoami
2. Creates a public repo at <username>/<REPO_NAME> (idempotent)
3. Uploads README.md (the model card), Modelfile, and the GGUF
4. Prints the public URL

After publish anyone can pull it via:
    ollama pull hf.co/<username>/alio-medical
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def main() -> int:
    token = os.environ.get("HF_TOKEN")
    if not token:
        print("ERROR: set $env:HF_TOKEN to your HuggingFace Write token")
        print("Get one at https://huggingface.co/settings/tokens")
        return 1

    repo_name = os.environ.get("REPO_NAME", "alio-medical-gemma4-e2b")
    gguf_path = Path(os.environ.get(
        "GGUF_PATH",
        r"C:\Users\aaron\Downloads\gemma-4-e2b-it.Q4_K_M.gguf",
    ))
    modelfile_path = Path(os.environ.get(
        "MODELFILE_PATH",
        r"C:\Users\aaron\Downloads\Modelfile",
    ))

    if not gguf_path.is_file():
        print(f"ERROR: GGUF file not found at {gguf_path}")
        return 1
    if not modelfile_path.is_file():
        print(f"ERROR: Modelfile not found at {modelfile_path}")
        return 1

    from huggingface_hub import HfApi, create_repo, whoami

    api = HfApi(token=token)
    user = whoami(token=token)
    username = user["name"]
    repo_id = f"{username}/{repo_name}"
    print(f"Authenticated as: {username}")
    print(f"Target repo:      {repo_id}")
    print(f"GGUF size:        {gguf_path.stat().st_size / 1e9:.2f} GB")
    print()

    # 1. Create the repo (idempotent)
    print(f"[1/4] Creating/ensuring repo {repo_id} …")
    create_repo(
        repo_id=repo_id,
        token=token,
        repo_type="model",
        private=False,
        exist_ok=True,
    )

    # 2. Build and upload the model card
    card = f"""---
license: gemma
base_model: unsloth/gemma-4-E2B-it
tags:
- gemma
- gemma-4
- medical
- healthcare
- lora
- gguf
- unsloth
- ollama
- caregiver
- lab-interpretation
language:
- en
pipeline_tag: text-generation
---

# alio-medical (Gemma 4 E2B fine-tune)

Fine-tuned **Gemma 4 E2B** for plain-language medical text simplification, built
for the [Gemma 4 Good Hackathon](https://www.kaggle.com/competitions/gemma-4-good-hackathon)
on Kaggle (May 2026).

**Project:** Alio — an offline-first caregiver/family app that turns messy nurse
notes, voice transcripts, and scanned lab reports into plain-language updates
families can read in 30 seconds. Code at
[JzZ404/Alio](https://github.com/JzZ404/Alio).

## What this model does

Three tasks, all in plain English / family-readable language:

1. **Lab panel interpretation** — given a CMP, CBC, Lipid panel, A1c, etc., produce a JSON summary with flags and a follow-up urgency level
2. **Caregiver shift compilation** — turn a stream of voice notes from a single shift into one concise narrative
3. **Symptom triage** — classify a symptom report into `self_care` / `this_week` / `today` / `emergency` with a plain-language explanation

## Training

- **Base:** `unsloth/gemma-4-E2B-it` (5.15B params, "edge" tier)
- **Adapter:** LoRA r=16, α=32, dropout=0.05, all attention + MLP modules (`q,k,v,o,gate,up,down`)
- **Trainable params:** 31M / 5.15B = 0.60%
- **Data:** 898 train + 100 val pairs from three sources:
  - Kaggle Medical Transcriptions (real clinical notes filtered to general/internal medicine, cardiology, neurology) — labeled by hosted Gemma 4 31B (teacher-student distillation)
  - Synthetic lab panels — 15 panel types (CMP, CBC, Lipid, A1c, Iron, Vit D, B12, TSH, etc.) in MyChart/Epic format
  - Synthetic symptom triage scenarios across 4 severity tiers
- **Trainer:** Unsloth + TRL SFTTrainer on Kaggle T4 (2 epochs, lr=5e-5, max_grad_norm=1.0)
- **Quantization:** q4_k_m GGUF for portable local inference

## How to use

### Via Ollama (recommended)

```bash
ollama pull hf.co/{repo_id}
ollama run hf.co/{repo_id} "Glucose 218 mg/dL, BUN 42, Creatinine 2.1, eGFR 35. Explain in plain language."
```

Or with the included Modelfile:

```bash
ollama create alio-medical -f Modelfile
ollama run alio-medical
```

### Chat template

The model expects Gemma 4's chat template:

```
<|turn>system
You are a medical assistant that explains health information in plain language for family members.<turn|>
<|turn>user
[your input]<turn|>
<|turn>model
```

Recommended sampling: `temperature=0.4`, `top_p=0.9`, `stop="<turn|>"`.

## Files in this repo

- `gemma-4-e2b-it.Q4_K_M.gguf` — the quantized model weights (3.4 GB)
- `Modelfile` — Ollama configuration with the correct chat template + stop tokens

## Limitations

- Tends to underplay severity for clearly-diabetic-range blood glucose values when given as bare numbers in voice-note context (use the lab-interpretation pathway for sharper response)
- For symptom triage, prefers `today` over `emergency` even when hard-escalation rules apply. The app's `_apply_escalation_override()` (keyword scanner) catches this in production.
- Image input requires an OCR step (Gemini Vision in the reference app); the model itself is text-only.
- Single-stage SFT only; no RLHF/DPO.

## Citation

```bibtex
@misc{{alio-medical-2026,
  author       = {{Aaron Yeung}},
  title        = {{Alio: Offline-first caregiver app with fine-tuned Gemma 4 E2B}},
  year         = {{2026}},
  howpublished = {{Kaggle Gemma 4 Good Hackathon}},
  url          = {{https://github.com/JzZ404/Alio}}
}}
```
"""

    print("[2/4] Uploading model card (README.md) …")
    api.upload_file(
        path_or_fileobj=card.encode("utf-8"),
        path_in_repo="README.md",
        repo_id=repo_id,
        repo_type="model",
        token=token,
        commit_message="Add model card",
    )

    print("[3/4] Uploading Modelfile …")
    api.upload_file(
        path_or_fileobj=str(modelfile_path),
        path_in_repo="Modelfile",
        repo_id=repo_id,
        repo_type="model",
        token=token,
        commit_message="Add Ollama Modelfile",
    )

    print(f"[4/4] Uploading {gguf_path.name} ({gguf_path.stat().st_size / 1e9:.2f} GB)…")
    print("    This is the slow step. Expect 10-30 min on a typical home connection.")
    api.upload_file(
        path_or_fileobj=str(gguf_path),
        path_in_repo=gguf_path.name,
        repo_id=repo_id,
        repo_type="model",
        token=token,
        commit_message="Add fine-tuned Gemma 4 E2B q4_k_m GGUF",
    )

    print()
    print("=" * 60)
    print("DONE. Public model URL:")
    print(f"  https://huggingface.co/{repo_id}")
    print()
    print("Anyone can now pull it via:")
    print(f"  ollama pull hf.co/{repo_id}")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
