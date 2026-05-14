export const ERROR_MESSAGES = {
  unauthorized: "Please sign in again to keep working.",
  forbidden: "You do not have access to that action.",
  not_found: "We could not find what you were looking for.",
  internal_server_error: "Something went wrong on our side. Please try again.",
  database_unavailable: "Could not save your entry. Please try again.",
};

export class ApiError extends Error {
  constructor({ message, code = "request_failed", status = 500, details = null }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function normalizeApiError(error) {
  if (!error.response) {
    const isTimeout =
      error.code === "ECONNABORTED" ||
      error.message?.toLowerCase().includes("timeout");

    return new ApiError({
      message: isTimeout
        ? "The request timed out. Please try again."
        : "Could not reach the server. Please check your connection and try again.",
      code: isTimeout ? "timeout" : "network_error",
      status: 0,
    });
  }

  const status = error.response.status ?? 500;
  const payload = error.response.data ?? {};
  const code = payload.code || "request_failed";

  let message = ERROR_MESSAGES[code];
  if (!message && code === "validation_error" && payload.error) {
    message = payload.error;
  }
  if (!message && status < 500 && payload.error) {
    message = payload.error;
  }
  if (!message) {
    message =
      status >= 500
        ? "Something went wrong on our side. Please try again."
        : "We could not complete that request.";
  }

  return new ApiError({
    message,
    code,
    status,
    details: payload,
  });
}
