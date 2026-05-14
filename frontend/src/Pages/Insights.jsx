import React, { useEffect, useMemo, useState } from "react";
import "./Insights.css";
import { dashboardAPI } from "../services/api";

const RANGE_OPTIONS = [
  { value: "7d",     label: "Last 7 days" },
  { value: "14d",    label: "Last 2 weeks" },
  { value: "1m",     label: "Last 1 month" },
  { value: "3m",     label: "Last 3 months" },
  { value: "custom", label: "Custom range" },
];

// How many days back each range covers
const RANGE_DAYS = { "7d": 7, "14d": 14, "1m": 30, "3m": 90 };

// Tone cycle for insight rows
const TONES = ["blue", "green", "purple"];

// ─── helpers ────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function shortDate(isoStr) {
  const [, m, d] = isoStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1]} ${Number(d)}`;
}

// Filter ChartData labels+datasets to only include points within range
function filterChartData(chartData, cutoff) {
  if (!chartData) return null;
  const { labels, datasets } = chartData;
  const indices = labels
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => new Date(l) >= cutoff)
    .map(({ i }) => i);
  if (indices.length === 0) return null;
  return {
    labels: indices.map((i) => labels[i]),
    datasets: datasets.map((ds) => ({
      ...ds,
      data: indices.map((i) => ds.data[i]),
    })),
  };
}

// ─── sub-components ─────────────────────────────────────────

function Card({ className = "", children }) {
  return <div className={`ins-card ${className}`}>{children}</div>;
}

function InsightRow({ tone = "blue", text }) {
  return (
    <div className={`ins-insightRow ins-insightRow--${tone}`}>
      <div className="ins-insightRow__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 5.5C4 4.12 5.12 3 6.5 3h11C18.88 3 20 4.12 20 5.5v8c0 1.38-1.12 2.5-2.5 2.5H10l-4.2 3.1c-.5.37-1.2.02-1.2-.6V16H6.5C5.12 16 4 14.88 4 13.5v-8Z"
            stroke="currentColor" strokeWidth="1.6"
          />
          <path d="M7.5 7.8h9M7.5 10.8h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <div className="ins-insightRow__text">{text}</div>
    </div>
  );
}

function EmptyChart({ label }) {
  return (
    <Card className="ins-chartCard">
      <div className="ins-chartCard__head">
        <div className="ins-chartTitle">{label}</div>
      </div>
      <div className="ins-chartEmpty">No data for this period.</div>
    </Card>
  );
}

function MiniLineChart({ title, subtitle, tone = "blue", chartData }) {
  const { points, labels } = useMemo(() => {
    if (!chartData) return { points: [], labels: [] };
    const ds = chartData.datasets[0];
    const pts = ds.data.map((v) => (v === null || v === undefined ? null : Number(v)));
    const labs = chartData.labels.map(shortDate);
    return { points: pts, labels: labs };
  }, [chartData]);

  const { path, areaPath, dotCoords } = useMemo(() => {
    if (points.length < 2) return { path: "", areaPath: "", dotCoords: [] };

    const padL = 38, padR = 14, padT = 16, padB = 32;
    const w = 520, h = 220;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;

    // Only use non-null points for drawing
    const validPts = points
      .map((y, i) => ({ y, i }))
      .filter(({ y }) => y !== null);

    if (validPts.length < 2) return { path: "", areaPath: "", dotCoords: [] };

    const xStep = innerW / (points.length - 1 || 1);

    const xy = validPts.map(({ y, i }) => {
      const x = padL + i * xStep;
      const t = Math.max(0, Math.min(1, y / 5));
      return { x, y: padT + (1 - t) * innerH };
    });

    const d = [`M ${xy[0].x} ${xy[0].y}`];
    for (let i = 1; i < xy.length; i++) {
      const p0 = xy[i - 1], p1 = xy[i];
      const cx = (p0.x + p1.x) / 2;
      d.push(`C ${cx} ${p0.y} ${cx} ${p1.y} ${p1.x} ${p1.y}`);
    }
    const linePath = d.join(" ");
    const baselineY = padT + innerH;
    const area = [linePath, `L ${xy[xy.length-1].x} ${baselineY}`, `L ${xy[0].x} ${baselineY}`, "Z"].join(" ");

    const dotCoords = validPts.map(({ y, i }) => ({
      cx: padL + i * xStep,
      cy: padT + (1 - Math.max(0, Math.min(1, y / 5))) * innerH,
    }));

    return { path: linePath, areaPath: area, dotCoords };
  }, [points]);

  if (!chartData || points.length < 2) return <EmptyChart label={title} />;

  // Pick evenly spaced x-axis labels (max 6)
  const maxLabels = 6;
  const step = Math.max(1, Math.ceil(labels.length / maxLabels));
  const xAxisLabels = labels
    .map((l, i) => ({ l, i }))
    .filter(({ i }) => i % step === 0 || i === labels.length - 1);

  return (
    <Card className="ins-chartCard">
      <div className="ins-chartCard__head">
        <div className="ins-chartTitle">{title}</div>
        {subtitle && <div className="ins-chartSubtitle">{subtitle}</div>}
      </div>
      <div className="ins-chartWrap">
        <svg className="ins-chart" viewBox="0 0 520 220" role="img" aria-label={title}>
          <g className="ins-grid">
            {[0,1,2,3,4,5].map((i) => {
              const y = 16 + (172 * i) / 5;
              return <line key={`h-${i}`} x1="38" y1={y} x2="506" y2={y} />;
            })}
          </g>
          <g className="ins-axisLabels">
            {[5,4,3,2,1].map((val, idx) => {
              const y = 16 + (172 * idx) / 4;
              return <text key={val} x="12" y={y + 4}>{val}</text>;
            })}
          </g>
          {areaPath && <path className={`ins-area ins-area--${tone}`} d={areaPath} />}
          {path && <path className={`ins-line ins-line--${tone}`} d={path} />}
          {dotCoords.map(({ cx, cy }, i) => (
            <circle key={i} className={`ins-dot ins-dot--${tone}`} cx={cx} cy={cy} r="4" />
          ))}
          <g className="ins-xLabels">
            {xAxisLabels.map(({ l, i }) => {
              const x = 38 + (468 * i) / (labels.length - 1 || 1);
              return <text key={i} x={x} y="214" textAnchor="middle">{l}</text>;
            })}
          </g>
        </svg>
      </div>
    </Card>
  );
}

function SkeletonCard({ height = 80 }) {
  return (
    <div className="ins-skeleton" style={{ height }} />
  );
}

// ─── main component ──────────────────────────────────────────

export default function Insights() {
  const [range, setRange] = useState("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  useEffect(() => {
    let active = true;
    async function fetchDashboard() {
      setLoading(true);
      setError("");
      try {
        const res = await dashboardAPI.get();
        if (active) setDashboard(res.data);
      } catch (err) {
        if (active) setError(err.response?.data?.detail || "Failed to load insights.");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchDashboard();
    return () => { active = false; };
  }, []);

  // Compute cutoff date for range filter
  const cutoff = useMemo(() => {
    if (range === "custom") {
      if (customFrom) return new Date(customFrom);
      return daysAgo(7);
    }
    return daysAgo(RANGE_DAYS[range] ?? 7);
  }, [range, customFrom]);

  // Filter chart data to selected range
  const moodTrend = useMemo(
    () => filterChartData(dashboard?.mood_trend, cutoff),
    [dashboard, cutoff]
  );
  const sentimentTrend = useMemo(
    () => filterChartData(dashboard?.sentiment_trend, cutoff),
    [dashboard, cutoff]
  );

  const weeklySummary = dashboard?.weekly_summary ?? null;
  const insights      = dashboard?.insights ?? [];
  const suggestion    = dashboard?.suggestion ?? null;

  return (
    <main className="ins-page">
      <div className="ins-inner">

        {/* Header row */}
        <div className="ins-topRow">
          <div>
            <div className="ins-subtitle">Patterns and reflections from your recent entries.</div>
          </div>
          <div className="ins-range">
            <select
              className="ins-rangeSelect"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              aria-label="Select date range"
            >
              {RANGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {range === "custom" && (
              <div className="ins-customDates">
                <label className="ins-dateLabel">
                  <span className="ins-dateLabel__txt">From</span>
                  <input className="ins-dateInput" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                </label>
                <label className="ins-dateLabel">
                  <span className="ins-dateLabel__txt">To</span>
                  <input className="ins-dateInput" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="ins-error">{error}</div>
        )}

        {/* Weekly summary */}
        {loading ? (
          <SkeletonCard height={100} />
        ) : (
          <Card className="ins-summaryCard">
            <div className="ins-summaryTitle">Your emotional pattern lately</div>
            <p className="ins-summaryText">
              {weeklySummary || "No check-ins yet. Start journaling to see your weekly summary here."}
            </p>
          </Card>
        )}

        {/* Charts */}
        {loading ? (
          <div className="ins-grid2">
            <SkeletonCard height={260} />
            <SkeletonCard height={260} />
          </div>
        ) : (
          <div className="ins-grid2">
            <MiniLineChart
              title="Mood Trend"
              subtitle="Daily average mood (0–5)"
              tone="blue"
              chartData={moodTrend}
            />
            <MiniLineChart
              title="Sentiment Trend"
              subtitle="AI-analyzed reflection tone (0–5)"
              tone="green"
              chartData={sentimentTrend}
            />
          </div>
        )}

        {/* What We're Noticing */}
        {loading ? (
          <SkeletonCard height={140} />
        ) : (
          <Card className="ins-noticingCard">
            <div className="ins-noticingTitle">What We're Noticing</div>
            <div className="ins-noticingList">
              {insights.length > 0 ? (
                insights.map((text, i) => (
                  <InsightRow key={i} tone={TONES[i % TONES.length]} text={text} />
                ))
              ) : (
                <div className="ins-noticingEmpty">
                  Keep journaling — patterns will appear here once you have more entries.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Personalized suggestion */}
        {loading ? (
          <SkeletonCard height={100} />
        ) : (
          <Card className="ins-suggestCard">
            <div className="ins-suggestTitle">Personalized Suggestion</div>
            <div className="ins-suggestText">
              {suggestion || "No suggestion available yet. Submit a check-in to get a personalized tip."}
            </div>
          </Card>
        )}

      </div>
    </main>
  );
}