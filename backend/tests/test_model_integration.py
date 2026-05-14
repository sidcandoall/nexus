import os
import unittest
import importlib
from unittest.mock import patch

from app.main import app
import app.main as main_module
import app.sentiment_service as sentiment_service


class TestSentimentFallback(unittest.TestCase):
    def test_local_success_uses_local_result(self):
        with patch("app.sentiment_service._analyze_local", return_value=("POSITIVE", 0.9)):
            with patch.dict(
                os.environ,
                {
                    "SENTIMENT_USE_REMOTE_MODEL": "false",
                    "SENTIMENT_USE_REMOTE_FALLBACK": "true",
                },
                clear=False,
            ):
                label, score = sentiment_service.analyze_sentiment("I feel great")

        self.assertEqual(label, "POSITIVE")
        self.assertAlmostEqual(score, 0.9)

    def test_local_failure_falls_back_to_remote(self):
        with patch("app.sentiment_service._analyze_local", side_effect=RuntimeError("local failed")):
            with patch("app.sentiment_service._analyze_remote", return_value=("NEGATIVE", 0.8)):
                with patch.dict(
                    os.environ,
                    {
                        "SENTIMENT_USE_REMOTE_MODEL": "false",
                        "SENTIMENT_USE_REMOTE_FALLBACK": "true",
                    },
                    clear=False,
                ):
                    label, score = sentiment_service.analyze_sentiment("I feel bad")

        self.assertEqual(label, "NEGATIVE")
        self.assertAlmostEqual(score, 0.8)

    def test_both_fail_returns_neutral(self):
        with patch("app.sentiment_service._analyze_local", side_effect=RuntimeError("local failed")):
            with patch("app.sentiment_service._analyze_remote", side_effect=RuntimeError("remote failed")):
                with patch.dict(
                    os.environ,
                    {
                        "SENTIMENT_USE_REMOTE_MODEL": "false",
                        "SENTIMENT_USE_REMOTE_FALLBACK": "true",
                    },
                    clear=False,
                ):
                    label, score = sentiment_service.analyze_sentiment("Any text")

        self.assertEqual(label, "NEUTRAL")
        self.assertAlmostEqual(score, 0.0)


class TestApiModelIntegration(unittest.TestCase):
    def setUp(self):
        testclient = importlib.import_module("fastapi.testclient")
        self.client = testclient.TestClient(app)
        main_module._memory_store.clear()

    def test_checkin_uses_model_output_and_summary_aggregates(self):
        with patch("app.main.analyze_sentiment", return_value=("POSITIVE", 0.77)):
            with patch("app.main.get_suggestion", return_value="Keep it up"):
                with patch("app.main.get_journals_collection", side_effect=RuntimeError("db down")):
                    response = self.client.post(
                        "/api/checkin",
                        json={"mood": 4, "reflection": "Had a nice day"},
                    )

                    summary_response = self.client.get("/api/sentiment-summary")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["sentiment"], "POSITIVE")
        self.assertAlmostEqual(body["confidence"], 0.77)

        self.assertEqual(summary_response.status_code, 200)
        summary_body = summary_response.json()
        self.assertEqual(summary_body["total_entries"], 1)
        self.assertEqual(summary_body["counts"], [{"sentiment": "POSITIVE", "count": 1}])


if __name__ == "__main__":
    unittest.main()
