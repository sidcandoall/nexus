import React, { useEffect, useMemo, useRef, useState } from "react";
import "./MoodTrendChart.css";

const SENTIMENT_COLORS = {
  positive: "#62a88e",
  negative: "#e8726b",
  neutral: "#6c8fc6",
  Pending: "#a3a3a3",
};

const SENTIMENT_GRADIENTS = {
  positive: { light: "#a8d4b8", dark: "#3d6b56" },
  negative: { light: "#f5b3ac", dark: "#9c4035" },
  neutral: { light: "#a0c1e8", dark: "#3d5a99" },
  Pending: { light: "#d4d4d4", dark: "#7a7a7a" },
};

function normalizeSentimentLabel(label) {
  if (label === null || label === undefined) return "Pending";
  const normalized = String(label).trim().toLowerCase();
  if (normalized === "positive") return "positive";
  if (normalized === "negative") return "negative";
  if (normalized === "neutral") return "neutral";
  if (normalized === "pending") return "Pending";
  return "Pending";
}

function sentimentToValue(label) {
  if (label === "positive") return 1;
  if (label === "negative") return -1;
  if (label === "neutral") return 0;
  return 0;
}

function prettyLabel(label) {
  if (label === "Pending") return "Pending";
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullDate(value) {
  return new Date(value).toLocaleString("en-US", { 
    month: "short", 
    day: "numeric", 
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatConfidence(score) {
  if (score === null || score === undefined) return "N/A";
  return `${Math.round(score * 100)}%`;
}

export default function MoodTrendChart({ points = [], title = "Mood Trend", showPending = true }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [chartType, setChartType] = useState("mountain");
  const [windowStart, setWindowStart] = useState(0);
  const [chartWidth, setChartWidth] = useState(900);
  const chartRef = useRef(null);
  const chartWrapRef = useRef(null);

  const safePoints = useMemo(() => {
    // Keep chart deterministic and ordered by date for consistent snapshots.
    return [...points]
      .map((item) => ({
        ...item,
        sentiment_label: normalizeSentimentLabel(item.sentiment_label),
      }))
      .filter((item) => (showPending ? true : item.sentiment_label !== "Pending"))
      .sort((left, right) => new Date(left.date) - new Date(right.date));
  }, [points, showPending]);

  useEffect(() => {
    // Click-away behavior dismisses tooltip for both mouse and touch flows.
    function handleClickAway(event) {
      if (!chartRef.current) return;
      if (!chartRef.current.contains(event.target)) {
        setActiveIndex(null);
      }
    }

    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("touchstart", handleClickAway);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("touchstart", handleClickAway);
    };
  }, []);

  useEffect(() => {
    const element = chartWrapRef.current;
    if (!element) return;

    const updateWidth = () => {
      setChartWidth(Math.max(320, Math.round(element.clientWidth || 900)));
    };

    updateWidth();

    if (typeof window !== "undefined" && "ResizeObserver" in window) {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const width = 800;
  const height = 380;
  const padLeft = 108;
  const padTop = 40;
  const padBottom = 60;
  const padRight = 24;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVisiblePoints = useMemo(() => {
    if (chartType === "bar") {
      if (chartWidth < 480) return 5;
      if (chartWidth < 768) return 7;
      return 10;
    }
    if (chartWidth < 480) return 6;
    if (chartWidth < 768) return 9;
    return 14;
  }, [chartType, chartWidth]);

  const visibleCount = Math.min(safePoints.length, maxVisiblePoints);
  const maxWindowStart = Math.max(0, safePoints.length - visibleCount);

  useEffect(() => {
    setWindowStart((previous) => Math.min(previous, maxWindowStart));
    setActiveIndex(null);
    setHoveredIndex(null);
  }, [maxWindowStart, chartType, safePoints.length]);

  const visiblePoints = useMemo(
    () =>
      safePoints
        .slice(windowStart, windowStart + visibleCount)
        .map((point, localIndex) => ({
          ...point,
          globalIndex: windowStart + localIndex,
        })),
    [safePoints, windowStart, visibleCount],
  );

  const xInset = chartType === "bar" ? 24 : 0;
  const plotStartX = padLeft + xInset;
  const plotWidth = Math.max(1, innerW - xInset * 2);
  const mountainInsetRatio = chartType === "mountain" ? 0.12 : 0;

  const valueToY = (value) => {
    const normalized = (value + 1) / 2;
    const insetTop = padTop + innerH * mountainInsetRatio;
    const usableHeight = innerH * (1 - mountainInsetRatio * 2);
    return insetTop + (1 - normalized) * usableHeight;
  };

  const mapped = visiblePoints.map((item, index) => {
    const x =
      visiblePoints.length === 1
        ? plotStartX + plotWidth / 2
        : plotStartX + (plotWidth * index) / Math.max(1, visiblePoints.length - 1);
    const y = valueToY(sentimentToValue(item.sentiment_label));
    return {
      ...item,
      x,
      y,
      color: SENTIMENT_COLORS[item.sentiment_label] || SENTIMENT_COLORS.Pending,
      gradient: SENTIMENT_GRADIENTS[item.sentiment_label] || SENTIMENT_GRADIENTS.Pending,
      index,
      globalIndex: item.globalIndex,
    };
  });

  // Create smooth mountain path using cubic bezier curves
  const path = mapped
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const prev = mapped[index - 1];
      const cp1x = prev.x + (point.x - prev.x) / 3;
      const cp2x = prev.x + ((point.x - prev.x) * 2) / 3;
      return `C ${cp1x} ${prev.y} ${cp2x} ${point.y} ${point.x} ${point.y}`;
    })
    .join(" ");

  // Create mountain area fill path
  const areaPath = mapped.length > 0
    ? `M ${padLeft} ${padTop + innerH} L ${mapped[0].x} ${mapped[0].y} ${mapped
        .slice(1)
        .map((point, index) => {
          const prev = mapped[index];
          const cp1x = prev.x + (point.x - prev.x) / 3;
          const cp2x = prev.x + ((point.x - prev.x) * 2) / 3;
          return `C ${cp1x} ${prev.y} ${cp2x} ${point.y} ${point.x} ${point.y}`;
      })
      .join(" ")} L ${padLeft + innerW} ${padTop + innerH} Z`
    : "";

  const activePoint = activeIndex === null ? null : mapped.find((point) => point.globalIndex === activeIndex) || null;
  const hoverPoint = hoveredIndex === null ? null : mapped.find((point) => point.globalIndex === hoveredIndex) || null;
  const displayPoint = hoverPoint || activePoint;

  const yAxisLabels = [
    { value: "Negative", pos: valueToY(-1), sentiment: "negative" },
    { value: "Neutral", pos: valueToY(0), sentiment: "neutral" },
    { value: "Positive", pos: valueToY(1), sentiment: "positive" },
  ];

  const neutralBaselineY = valueToY(0);
  const stepX = mapped.length > 1 ? innerW / (mapped.length - 1) : innerW;
  const barWidth = Math.max(10, Math.min(44, stepX * 0.68));

  const xAxisIndices = mapped.length <= 4 
    ? mapped.map((_, i) => i)
    : [0, Math.floor(mapped.length / 3), Math.floor((mapped.length * 2) / 3), mapped.length - 1];

  const tooltipLeftPct = displayPoint ? Math.min(92, Math.max(8, (displayPoint.x / width) * 100)) : 50;

  if (!safePoints.length) {
    return (
      <section className="mtc-card" data-testid="mood-trend-chart-empty">
        <div className="mtc-header">
          <h3 className="mtc-title">{title}</h3>
        </div>
        <div className="mtc-empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mtc-empty-icon">
            <path d="M8 28L16 18L24 24L40 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="16" cy="18" r="2" fill="currentColor" />
            <circle cx="24" cy="24" r="2" fill="currentColor" />
            <circle cx="40" cy="8" r="2" fill="currentColor" />
          </svg>
          <p className="mtc-empty">No mood entries yet. Start journaling to see your emotional trends.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mtc-card" ref={chartRef} data-testid="mood-trend-chart">
      <div className="mtc-header">
        <div>
          <h3 className="mtc-title">{title}</h3>
          <p className="mtc-subtitle">Track your emotional patterns over time</p>
        </div>
        <div className="mtc-controls">
          <div className="mtc-legend">
            {[
              { label: "Positive", color: SENTIMENT_COLORS.positive },
              { label: "Neutral", color: SENTIMENT_COLORS.neutral },
              { label: "Negative", color: SENTIMENT_COLORS.negative },
            ].map((item) => (
              <div key={item.label} className="mtc-legend-item">
                <div className="mtc-legend-dot" style={{ backgroundColor: item.color }}></div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mtc-chart-toggle">
            <button
              className={`mtc-toggle-btn ${chartType === "mountain" ? "mtc-toggle-btn--active" : ""}`}
              onClick={() => setChartType("mountain")}
              title="Mountain Chart"
              aria-label="Mountain chart"
            >
              ⛰
            </button>
            <button
              className={`mtc-toggle-btn ${chartType === "bar" ? "mtc-toggle-btn--active" : ""}`}
              onClick={() => setChartType("bar")}
              title="Bar Chart"
              aria-label="Bar chart"
            >
              📊
            </button>
          </div>
        </div>
      </div>
      <div className="mtc-chartWrap" ref={chartWrapRef}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="mtc-svg"
          role="img"
          aria-label="Mood trend chart"
        >
          <defs>
            <clipPath id="mtc-plot-clip">
              <rect x={padLeft} y={padTop} width={innerW} height={innerH} />
            </clipPath>
            <linearGradient id="mtc-positive-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#62a88e" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#62a88e" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="mtc-negative-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e8726b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#e8726b" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="mtc-neutral-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6c8fc6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#6c8fc6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <g className="mtc-grid">
            {yAxisLabels.map((label, idx) => (
              <line
                key={`grid-${idx}`}
                x1={padLeft}
                y1={label.pos}
                x2={padLeft + innerW}
                y2={label.pos}
                className="mtc-gridLine"
              />
            ))}
          </g>

          {/* Axes */}
          <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + innerH} className="mtc-axis" />
          <line
            x1={padLeft}
            y1={padTop + innerH}
            x2={padLeft + innerW}
            y2={padTop + innerH}
            className="mtc-axis"
          />

          {/* Y-axis labels */}
          {yAxisLabels.map((label, idx) => (
            <text
              key={`y-label-${idx}`}
                x={padLeft - 18}
              y={label.pos + 4}
              className="mtc-axisLabel"
              textAnchor="end"
              fill={SENTIMENT_COLORS[label.sentiment]}
            >
              {label.value}
            </text>
          ))}

          {chartType === "mountain" ? (
            <g clipPath="url(#mtc-plot-clip)">
              {/* Area fill - Mountain style */}
              {areaPath && (
                <path
                  d={areaPath}
                  className="mtc-area"
                  fill="url(#mtc-neutral-gradient)"
                />
              )}
              {/* Mountain line */}
              <path d={path} className="mtc-line mtc-line--mountain" />
              {/* Data points */}
              {mapped.map((point) => (
                <circle
                  key={`point-${point.globalIndex}`}
                  data-testid={`mood-point-${point.globalIndex}`}
                  cx={point.x}
                  cy={point.y}
                  r={hoveredIndex === point.globalIndex || activeIndex === point.globalIndex ? 7 : 5}
                  className={`mtc-point mtc-point--${point.sentiment_label} ${hoveredIndex === point.globalIndex || activeIndex === point.globalIndex ? "mtc-point--active" : ""}`}
                  fill={point.color}
                  strokeWidth="2.5"
                  stroke="white"
                  style={{ cursor: "pointer", transition: "r 200ms ease, filter 200ms ease" }}
                  onMouseEnter={() => { setHoveredIndex(point.globalIndex); setActiveIndex(point.globalIndex); }}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setActiveIndex(point.globalIndex)}
                />
              ))}
            </g>
          ) : (
            <g clipPath="url(#mtc-plot-clip)">
              {/* Bar chart */}
              {mapped.map((point) => {
                const sentimentValue = sentimentToValue(point.sentiment_label);
                const zeroHeight = 2;
                const barTop = sentimentValue >= 0 ? point.y : neutralBaselineY;
                const barHeight =
                  sentimentValue === 0
                    ? zeroHeight
                    : Math.max(8, Math.abs(point.y - neutralBaselineY));
                return (
                  <g key={`bar-${point.globalIndex}`}>
                    <rect
                      x={point.x - barWidth / 2}
                      y={barTop}
                      width={barWidth}
                      height={barHeight}
                      className={`mtc-bar mtc-bar--${point.sentiment_label} ${hoveredIndex === point.globalIndex || activeIndex === point.globalIndex ? "mtc-bar--active" : ""}`}
                      fill={point.color}
                      opacity={hoveredIndex === point.globalIndex || activeIndex === point.globalIndex ? 1 : 0.8}
                      style={{ cursor: "pointer", transition: "opacity 200ms ease, filter 200ms ease" }}
                      onMouseEnter={() => { setHoveredIndex(point.globalIndex); setActiveIndex(point.globalIndex); }}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => setActiveIndex(point.globalIndex)}
                    />
                    <circle
                      cx={point.x}
                      cy={sentimentValue >= 0 ? point.y : neutralBaselineY + barHeight}
                      r={hoveredIndex === point.globalIndex || activeIndex === point.globalIndex ? 5 : 3}
                      fill="white"
                      stroke={point.color}
                      strokeWidth="2"
                      style={{ transition: "r 200ms ease" }}
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* X-axis labels */}
          <g className="mtc-xLabels">
            {xAxisIndices.map((idx) => {
              const point = mapped[idx];
              return (
                <text
                  key={`x-label-${idx}`}
                  x={point.x}
                  y={padTop + innerH + 28}
                  className="mtc-dateLabel"
                  textAnchor="middle"
                >
                  {formatDate(point.date)}
                </text>
              );
            })}
          </g>
        </svg>

        {/* Enhanced Tooltip */}
        {displayPoint && (
          <div className="mtc-tooltip" data-testid="mood-tooltip" style={{ left: `${tooltipLeftPct}%` }}>
            <div className="mtc-tooltip__inner">
              <div className="mtc-tooltip__sentiment-badge" style={{ backgroundColor: displayPoint.color }}>
                {prettyLabel(displayPoint.sentiment_label)}
              </div>
              <div className="mtc-tooltip__row">
                <span className="mtc-tooltip__label">Date:</span>
                <span className="mtc-tooltip__value">{formatFullDate(displayPoint.date)}</span>
              </div>
              <div className="mtc-tooltip__row">
                <span className="mtc-tooltip__label">Confidence:</span>
                <span className="mtc-tooltip__value">{formatConfidence(displayPoint.confidence_score)}</span>
              </div>
            </div>
          </div>
        )}

        {maxWindowStart > 0 && (
          <div className="mtc-sliderRow">
            <span className="mtc-sliderLabel">
              Showing {windowStart + 1}-{Math.min(windowStart + visibleCount, safePoints.length)} of {safePoints.length}
            </span>
            <input
              type="range"
              min={0}
              max={maxWindowStart}
              step={1}
              value={windowStart}
              onChange={(event) => {
                setWindowStart(Number(event.target.value));
                setActiveIndex(null);
                setHoveredIndex(null);
              }}
              className="mtc-slider"
              aria-label="Scroll chart entries"
            />
          </div>
        )}
      </div>
    </section>
  );
}
