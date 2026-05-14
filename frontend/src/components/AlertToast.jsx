import React from "react";
import "./AlertToast.css";

const DEFAULT_TITLES = {
  success: "Saved",
  info: "Notice",
  warning: "Saved with warning",
  error: "Could not complete that action",
};

export default function AlertToast({ severity = "info", title, message }) {
  const resolvedTitle = title || DEFAULT_TITLES[severity] || DEFAULT_TITLES.info;

  return (
    <div
      className={`mm-alertToast mm-alertToast--${severity}`}
      role="alert"
      aria-live={severity === "error" ? "assertive" : "polite"}
    >
      <div className="mm-alertToast__marker" aria-hidden="true" />
      <div className="mm-alertToast__content">
        <div className="mm-alertToast__title">{resolvedTitle}</div>
        <div className="mm-alertToast__message">{message}</div>
      </div>
    </div>
  );
}
