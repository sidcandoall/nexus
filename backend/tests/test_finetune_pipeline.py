import unittest
from pathlib import Path

from tests.pipeline.fine_tune_journal_sentiment import (
    LABEL_TO_ID,
    compute_metrics,
    load_examples,
    normalize_label,
    split_examples,
)


class TestFineTunePipeline(unittest.TestCase):
    @staticmethod
    def _sample_path() -> Path:
        return Path(__file__).resolve().parent / "pipeline" / "sample_journal_data.jsonl"

    def test_normalize_label_aliases(self):
        self.assertEqual(normalize_label("pos"), "POSITIVE")
        self.assertEqual(normalize_label("neg"), "NEGATIVE")
        self.assertEqual(normalize_label("neutral"), "NEUTRAL")

    def test_load_examples_jsonl(self):
        sample_path = self._sample_path()
        examples = load_examples(sample_path, text_column="reflection", label_column="sentiment")
        self.assertGreaterEqual(len(examples), 9)
        label_ids = {item.label_id for item in examples}
        self.assertEqual(label_ids, set(LABEL_TO_ID.values()))

    def test_split_examples_has_train_and_val(self):
        sample_path = self._sample_path()
        examples = load_examples(sample_path, text_column="reflection", label_column="sentiment")
        train, val = split_examples(examples, validation_ratio=0.2, seed=42)
        self.assertGreater(len(train), 0)
        self.assertGreater(len(val), 0)

    def test_compute_metrics(self):
        logits = [
            [0.1, 0.2, 0.7],
            [0.8, 0.1, 0.1],
            [0.1, 0.7, 0.2],
        ]
        labels = [2, 0, 1]
        metrics = compute_metrics((logits, labels))
        self.assertIn("accuracy", metrics)
        self.assertIn("f1_macro", metrics)
        self.assertGreaterEqual(metrics["accuracy"], 0.0)
        self.assertLessEqual(metrics["accuracy"], 1.0)


if __name__ == "__main__":
    unittest.main()
