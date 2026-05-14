#!/usr/bin/env python3
"""Fine-tune DistilBERT on journal sentiment data (POSITIVE/NEUTRAL/NEGATIVE)."""

from __future__ import annotations

import argparse
import csv
import json
import random
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
)


LABEL_TO_ID = {"NEGATIVE": 0, "NEUTRAL": 1, "POSITIVE": 2}
ID_TO_LABEL = {value: key for key, value in LABEL_TO_ID.items()}


@dataclass
class Example:
    text: str
    label_id: int


class JournalDataset(torch.utils.data.Dataset):
    def __init__(self, encodings: dict[str, Any], labels: list[int]):
        self.encodings = encodings
        self.labels = labels

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, index: int) -> dict[str, torch.Tensor]:
        item = {key: torch.tensor(value[index]) for key, value in self.encodings.items()}
        item["labels"] = torch.tensor(self.labels[index])
        return item


def normalize_label(value: str) -> str:
    raw = str(value).strip().upper()
    if raw in LABEL_TO_ID:
        return raw
    aliases = {
        "POS": "POSITIVE",
        "NEG": "NEGATIVE",
        "LABEL_0": "NEGATIVE",
        "LABEL_1": "NEUTRAL",
        "LABEL_2": "POSITIVE",
    }
    if raw in aliases:
        return aliases[raw]
    raise ValueError(f"Unsupported label: {value}")


def load_examples(file_path: Path, text_column: str, label_column: str) -> list[Example]:
    if not file_path.exists():
        raise FileNotFoundError(f"Data file not found: {file_path}")

    suffix = file_path.suffix.lower()
    records: list[dict[str, Any]] = []

    if suffix == ".csv":
        with file_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            records.extend(reader)
    elif suffix in {".jsonl", ".ndjson"}:
        with file_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if line:
                    records.append(json.loads(line))
    elif suffix == ".json":
        with file_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
            if not isinstance(payload, list):
                raise ValueError("JSON training file must be an array of objects")
            records.extend(payload)
    else:
        raise ValueError("Supported data formats: .csv, .jsonl, .json")

    examples: list[Example] = []
    for row in records:
        text = str(row.get(text_column, "")).strip()
        label_raw = str(row.get(label_column, "")).strip()
        if not text:
            continue
        label_name = normalize_label(label_raw)
        examples.append(Example(text=text, label_id=LABEL_TO_ID[label_name]))

    if not examples:
        raise ValueError("No valid examples found in dataset")
    return examples


def split_examples(examples: list[Example], validation_ratio: float, seed: int) -> tuple[list[Example], list[Example]]:
    shuffled = list(examples)
    random.Random(seed).shuffle(shuffled)
    val_size = max(1, int(len(shuffled) * validation_ratio))
    if len(shuffled) <= 3:
        val_size = 1
    train = shuffled[val_size:]
    val = shuffled[:val_size]
    if not train:
        train = shuffled[:-1]
        val = shuffled[-1:]
    return train, val


def build_training_args(args: argparse.Namespace) -> TrainingArguments:
    common = dict(
        output_dir=str(args.output_dir),
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        num_train_epochs=args.epochs,
        weight_decay=0.01,
        logging_steps=10,
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1_macro",
        greater_is_better=True,
        report_to="none",
    )

    try:
        return TrainingArguments(eval_strategy="epoch", **common)
    except TypeError:
        return TrainingArguments(evaluation_strategy="epoch", **common)


def macro_f1(y_true: np.ndarray, y_pred: np.ndarray, label_ids: list[int]) -> float:
    eps = 1e-12
    f1_scores = []
    for label_id in label_ids:
        tp = np.sum((y_true == label_id) & (y_pred == label_id))
        fp = np.sum((y_true != label_id) & (y_pred == label_id))
        fn = np.sum((y_true == label_id) & (y_pred != label_id))

        precision = tp / (tp + fp + eps)
        recall = tp / (tp + fn + eps)
        f1 = 2 * precision * recall / (precision + recall + eps)
        f1_scores.append(f1)
    return float(np.mean(f1_scores))


def compute_metrics(eval_pred: tuple[np.ndarray, np.ndarray]) -> dict[str, float]:
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    accuracy = float(np.mean(predictions == labels))
    f1 = macro_f1(labels, predictions, [0, 1, 2])
    return {
        "accuracy": accuracy,
        "f1_macro": f1,
    }


def tokenize_examples(tokenizer: AutoTokenizer, examples: list[Example], max_length: int) -> JournalDataset:
    texts = [item.text for item in examples]
    labels = [item.label_id for item in examples]
    encodings = tokenizer(texts, truncation=True, padding=True, max_length=max_length)
    return JournalDataset(encodings=encodings, labels=labels)


def zip_model_dir(source_dir: Path, zip_path: Path) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in source_dir.rglob("*"):
            if file_path.is_file():
                archive.write(file_path, arcname=file_path.relative_to(source_dir.parent))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune DistilBERT on journal sentiment data")
    parser.add_argument("--train-file", required=True, type=Path, help="Path to .csv/.json/.jsonl training dataset")
    parser.add_argument("--validation-file", type=Path, default=None, help="Optional validation dataset path")
    parser.add_argument("--text-column", default="reflection", help="Text column in dataset")
    parser.add_argument("--label-column", default="sentiment", help="Label column in dataset")
    parser.add_argument("--base-model", default="distilbert-base-uncased", help="Base HF model")
    parser.add_argument("--output-dir", type=Path, default=Path("mood_sentiment_model"), help="Fine-tuned model output dir")
    parser.add_argument("--zip-output", type=Path, default=Path("mood_sentiment_model.zip"), help="Output zip path")
    parser.add_argument("--epochs", type=float, default=2.0, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=8, help="Batch size")
    parser.add_argument("--learning-rate", type=float, default=2e-5, help="Learning rate")
    parser.add_argument("--max-length", type=int, default=256, help="Max token length")
    parser.add_argument("--validation-ratio", type=float, default=0.2, help="Validation split if no validation file")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    train_examples = load_examples(args.train_file, args.text_column, args.label_column)

    if args.validation_file:
        val_examples = load_examples(args.validation_file, args.text_column, args.label_column)
    else:
        train_examples, val_examples = split_examples(train_examples, args.validation_ratio, args.seed)

    tokenizer = AutoTokenizer.from_pretrained(args.base_model)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base_model,
        num_labels=3,
        id2label=ID_TO_LABEL,
        label2id=LABEL_TO_ID,
    )

    train_dataset = tokenize_examples(tokenizer, train_examples, args.max_length)
    eval_dataset = tokenize_examples(tokenizer, val_examples, args.max_length)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    training_args = build_training_args(args)

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
    )

    trainer.train()
    trainer.evaluate()

    model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)

    metadata = {
        "labels": ID_TO_LABEL,
        "text_column": args.text_column,
        "label_column": args.label_column,
    }
    (args.output_dir / "training_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    zip_model_dir(args.output_dir, args.zip_output)

    print(f"Saved fine-tuned model directory: {args.output_dir}")
    print(f"Saved fine-tuned zip model: {args.zip_output}")


if __name__ == "__main__":
    main()
