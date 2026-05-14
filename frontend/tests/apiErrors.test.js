import test from "node:test";
import assert from "node:assert/strict";

import { normalizeApiError } from "../src/services/apiErrors.js";

test("maps timeout errors to a user-friendly timeout message", () => {
  const error = {
    code: "ECONNABORTED",
    message: "timeout of 10000ms exceeded",
  };

  const normalized = normalizeApiError(error);

  assert.equal(normalized.code, "timeout");
  assert.equal(normalized.message, "The request timed out. Please try again.");
});

test("maps server database errors to a friendly save message", () => {
  const error = {
    response: {
      status: 500,
      data: {
        error: "Could not save your entry. Please try again.",
        code: "database_unavailable",
      },
    },
  };

  const normalized = normalizeApiError(error);

  assert.equal(normalized.code, "database_unavailable");
  assert.equal(normalized.message, "Could not save your entry. Please try again.");
});

test("preserves clear validation messages for invalid input", () => {
  const error = {
    response: {
      status: 400,
      data: {
        error: "mood: Input should be less than or equal to 5",
        code: "validation_error",
      },
    },
  };

  const normalized = normalizeApiError(error);

  assert.equal(normalized.code, "validation_error");
  assert.match(normalized.message, /mood/);
});
