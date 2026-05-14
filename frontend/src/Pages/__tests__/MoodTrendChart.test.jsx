import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MoodTrendChart from "../MoodTrendChart";

const oneEntry = [
  {
    date: "2026-04-10T10:00:00.000Z",
    sentiment_label: "positive",
    confidence_score: 0.91,
  },
];

const mixedTenEntries = Array.from({ length: 10 }).map((_, index) => {
  const labels = ["positive", "negative", "neutral"];
  return {
    date: new Date(Date.UTC(2026, 3, 10 + index)).toISOString(),
    sentiment_label: labels[index % labels.length],
    confidence_score: 0.45 + index * 0.04,
  };
});

describe("MoodTrendChart snapshots", () => {
  it("renders 0 entries snapshot", () => {
    const { container } = render(<MoodTrendChart points={[]} />);
    expect(screen.getByTestId("mood-trend-chart-empty")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("renders 1 entry snapshot", () => {
    const { container } = render(<MoodTrendChart points={oneEntry} />);
    expect(screen.getByTestId("mood-point-0")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("renders 10 mixed entries and tooltip snapshot", () => {
    const { container } = render(<MoodTrendChart points={mixedTenEntries} />);

    const middlePoint = screen.getByTestId("mood-point-4");
    fireEvent.mouseEnter(middlePoint);

    const tooltip = screen.getByTestId("mood-tooltip");
    expect(tooltip).toHaveTextContent("Date:");
    expect(tooltip).toHaveTextContent("Negative");
    expect(tooltip).toHaveTextContent("Confidence:");

    // Validate color style appears in rendered SVG for sentiment points.
    expect(container.querySelectorAll("circle.mtc-point").length).toBe(10);
    expect(container).toMatchSnapshot();
  });
});
