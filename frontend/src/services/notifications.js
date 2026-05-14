import React from "react";
import { toast } from "react-hot-toast";
import AlertToast from "../components/AlertToast";

export function showNotice({
  severity = "info",
  title,
  message,
  duration = 5000,
}) {
  return toast.custom(
    () =>
      React.createElement(AlertToast, {
        severity,
        title,
        message,
      }),
    {
      duration,
      position: "top-right",
    }
  );
}

export function showApiError(message) {
  return showNotice({
    severity: "error",
    title: "Could not complete that action",
    message,
  });
}
