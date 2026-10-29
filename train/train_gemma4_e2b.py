"""
train_gemma4_e2b.py
===================
Fine-tunes Gemma 4 E2B on medical text simplification using Unsloth + LoRA.
Targets the Kaggle/Colab free T4 GPU (16 GB VRAM).

Earns eligibility for the Unsloth Special Technology Prize ($10k).

Setup (run once in your Kaggle/Colab notebook cell first)
---------------------------------------------------------
    pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
    pip install --no-deps trl peft accelerate bitsandbytes

Usage
-----
    python train_gemma4_e2b.py

    # or with custom paths:
    TRAIN_JSONL=data/train.jsonl VAL_JSONL=data/val.jsonl python train_gemma4_e2b.py

Outputs
-------
  outputs/gemma4-e2b-medical-lora/   — LoRA adapter (load with Unsloth)
  outputs/gemma4-e2b-medical-gguf/   — GGUF file for Ollama (q4_k_m quantisation)
"""

import json
import os
from pathlib import Path

# ── config ────────────────────────────────────────────────────────────────────
BASE_MODEL   = "google/gemma-4-e2b-it"   # Unsloth will pull from HuggingFace
TRAIN_JSONL  = os.getenv("TRAIN_JSONL", "data/train.jsonl")
VAL_JSONL    = os.getenv("VAL_JSONL",   "data/val.jsonl")
OUTPUT_DIR   = "outputs/gemma4-e2b-medical-lora"
GGUF_DIR     = "outputs/gemma4-e2b-medical-gguf"

# LoRA hyperparams — tuned for T4 16 GB
LORA_RANK       = 16
LORA_ALPHA      = 32
LORA_DROPOUT    = 0.05
TARGET_MODULES  = ["q_proj", "k_proj", "v_proj", "o_proj",
                   "gate_proj", "up_proj", "down_proj"]

# Training hyperparams
MAX_SEQ_LENGTH  = 2048
BATCH_SIZE      = 2
GRAD_ACCUM      = 4      # effective batch = 8
EPOCHS          = 2
LR              = 2e-4
WARMUP_RATIO    = 0.05
SAVE_STEPS      = 100
LOGGING_STEPS   = 10


# ── load data ─────────────────────────────────────────────────────────────────

def load_jsonl(path: str) -> list[dict]:
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def to_hf_dataset(rows: list[dict]):
    """Convert ShareGPT-format rows to HuggingFace Dataset."""
    from datasets import Dataset
    return Dataset.from_list(rows)


# ── formatting ────────────────────────────────────────────────────────────────

def format_chat(example: dict, tokenizer) -> dict:
    """Apply the model's chat template to a ShareGPT-format row."""
    messages = []
    for turn in example["conversations"]:
        role = {"system": "system", "human": "user", "gpt": "assistant"}[turn["from"]]
        messages.append({"role": role, "content": turn["value"]})
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)
    return {"text": text}


# ── main ──────────────────────────────────────────────────────────────────────

def main():
    from unsloth import FastLanguageModel
    from trl import SFTTrainer, SFTConfig

    # 1. Load base model with 4-bit quantisation
    print(f"Loading {BASE_MODEL} …")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=BASE_MODEL,
        max_seq_length=MAX_SEQ_LENGTH,
        dtype=None,          # auto-detect (bfloat16 on A100, float16 on T4)
        load_in_4bit=True,
    )

    # 2. Attach LoRA adapters
    model = FastLanguageModel.get_peft_model(
        model,
        r=LORA_RANK,
        lora_alpha=LORA_ALPHA,
        lora_dropout=LORA_DROPOUT,
        target_modules=TARGET_MODULES,
        bias="none",
        use_gradient_checkpointing="unsloth",
        random_state=42,
    )

    # 3. Load datasets
    print("Loading training data …")
    train_rows = load_jsonl(TRAIN_JSONL)
    val_rows   = load_jsonl(VAL_JSONL)
    print(f"  Train: {len(train_rows)} rows | Val: {len(val_rows)} rows")

    train_ds = to_hf_dataset(train_rows)
    val_ds   = to_hf_dataset(val_rows)

    # Apply chat template
    train_ds = train_ds.map(lambda x: format_chat(x, tokenizer))
    val_ds   = val_ds.map(lambda x: format_chat(x, tokenizer))

    # 4. Train
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        dataset_text_field="text",
        max_seq_length=MAX_SEQ_LENGTH,
        args=SFTConfig(
            output_dir=OUTPUT_DIR,
            num_train_epochs=EPOCHS,
            per_device_train_batch_size=BATCH_SIZE,
            gradient_accumulation_steps=GRAD_ACCUM,
            learning_rate=LR,
            warmup_ratio=WARMUP_RATIO,
            lr_scheduler_type="cosine",
            fp16=not __import__("torch").cuda.is_bf16_supported(),
            bf16=__import__("torch").cuda.is_bf16_supported(),
            logging_steps=LOGGING_STEPS,
            save_steps=SAVE_STEPS,
            evaluation_strategy="steps",
            eval_steps=SAVE_STEPS,
            save_total_limit=2,
            load_best_model_at_end=True,
            report_to="none",   # set to "wandb" if you want W&B logging
        ),
    )

    print("\nStarting training …")
    trainer.train()

    # 5. Save LoRA adapter
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    print(f"\nLoRA adapter saved → {OUTPUT_DIR}")

    # 6. Export GGUF for Ollama (q4_k_m = good quality/size balance)
    print("\nExporting GGUF …")
    Path(GGUF_DIR).mkdir(parents=True, exist_ok=True)
    model.save_pretrained_gguf(
        GGUF_DIR,
        tokenizer,
        quantization_method="q4_k_m",
    )
    print(f"GGUF saved → {GGUF_DIR}")
    print("\nTo serve with Ollama:")
    print(f"  ollama create alio-medical -f {GGUF_DIR}/Modelfile")
    print(f"  ollama run alio-medical")


if __name__ == "__main__":
    main()
