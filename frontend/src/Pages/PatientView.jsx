import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./PatientView.css";
import api from "../services/api";

const SENTIMENT_META = {
  positive: { color: "#62a88e", emoji: "😊", label: "Positive", value: 1 },
  negative: { color: "#c47a7a", emoji: "😔", label: "Negative", value: -1 },
  neutral:  { color: "#9aa3ad", emoji: "😐", label: "Neutral",  value: 0 },
  Pending:  { color: "#c8a96a", emoji: "⏳", label: "Pending",  value: 0 },
};

function metaFor(label) {
  return SENTIMENT_META[label] || SENTIMENT_META.neutral;
}

function formatLong(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short", year: "numeric", month: "short", day: "numeric",
    });
  } catch { return iso || ""; }
}

function formatShort(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return ""; }
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch { return ""; }
}

export default function PatientView() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [moodTrend, setMoodTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("journal");

  useEffect(() => {
    let active = true;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, journalRes, moodRes] = await Promise.all([
          api.get(`/therapist/patients/${patientId}/profile`),
          api.get(`/therapist/patients/${patientId}/journal`),
          api.get(`/therapist/patients/${patientId}/mood`),
        ]);
        if (!active) return;
        setProfile(profileRes.data);
        setEntries(journalRes.data.entries || []);
        setMoodTrend(moodRes.data.points || []);
      } catch (err) {
        if (!active) return;
        const status = err.response?.status;
        const detail = err.response?.data?.detail;
        setError(
          status === 403
            ? detail || "This patient has not shared their data with you."
            : detail || "Could not load this patient's data."
        );
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchData();
    return () => { active = false; };
  }, [patientId]);

  const initials = useMemo(() => {
    return (profile?.name || "?")
      .split(" ").filter(Boolean).slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
  }, [profile]);

  const sentimentSummary = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    moodTrend.forEach((p) => {
      const k = (p.sentiment_label || "").toLowerCase();
      if (counts[k] !== undefined) counts[k] += 1;
    });
    const total = counts.positive + counts.neutral + counts.negative;
    return { counts, total };
  }, [moodTrend]);

  const entriesByDay = useMemo(() => {
    const sorted = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
    const groups = new Map();
    sorted.forEach((e) => {
      const key = formatLong(e.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    });
    return groups;
  }, [entries]);

  return (
    <main className="pv-page">
      <div className="pv-inner">
        <button type="button" className="pv-back" onClick={() => navigate("/therapist/dashboard")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to all patients
        </button>

        {loading ? (
          <div className="pv-skeletonHeader" />
        ) : error ? (
          <div className="pv-blocked">
            <div className="pv-blocked__icon" aria-hidden="true">🔒</div>
            <h2 className="pv-blocked__title">Access restricted</h2>
            <p className="pv-blocked__text">{error}</p>
            <button className="pv-blocked__btn" onClick={() => navigate("/therapist/dashboard")}>
              Return to dashboard
            </button>
          </div>
        ) : (
          <>
            <section className="pv-header">
              <div className="pv-header__left">
                <div className="pv-header__avatar">{initials}</div>
                <div className="pv-header__info">
                  <h1 className="pv-header__name">{profile?.name}</h1>
                  <p className="pv-header__email">{profile?.email}</p>
                </div>
              </div>

              <div className="pv-header__right">
                <div className={`pv-header__status ${profile?.sharing_enabled ? "is-on" : "is-off"}`}>
                  <span className="pv-header__statusDot" />
                  {profile?.sharing_enabled ? "Sharing enabled" : "Sharing paused"}
                </div>
                <div className="pv-header__readonly">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 15v2m-7-2a4 4 0 0 1-1-2.6 4 4 0 0 1 4-4h8a4 4 0 0 1 4 4 4 4 0 0 1-1 2.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M12 13v6m-3-9V8a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  Read-only access
                </div>
              </div>
            </section>

            <div className="pv-tabs">
              <button type="button" className={`pv-tab ${activeTab === "journal" ? "is-active" : ""}`} onClick={() => setActiveTab("journal")}>
                <span className="pv-tab__label">Journal entries</span>
                <span className="pv-tab__count">{entries.length}</span>
              </button>
              <button type="button" className={`pv-tab ${activeTab === "mood" ? "is-active" : ""}`} onClick={() => setActiveTab("mood")}>
                <span className="pv-tab__label">Mood trend</span>
                <span className="pv-tab__count">{moodTrend.length}</span>
              </button>
            </div>

            {activeTab === "journal" ? (
              <JournalTab entries={entries} entriesByDay={entriesByDay} />
            ) : (
              <MoodTab moodTrend={moodTrend} summary={sentimentSummary} />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function JournalTab({ entries, entriesByDay }) {
  if (entries.length === 0) {
    return (
      <EmptyCard
        icon="📓"
        title="No shared entries yet"
        hint="This patient hasn't shared any journal entries with you. Entries appear here only when the patient explicitly shares them."
      />
    );
  }

  return (
    <div className="pv-journal">
      {Array.from(entriesByDay.entries()).map(([dayLabel, dayEntries]) => (
        <div key={dayLabel} className="pv-day">
          <div className="pv-day__label">{dayLabel}</div>
          <div className="pv-day__entries">
            {dayEntries.map((entry, idx) => {
              const meta = metaFor(entry.sentiment_label);
              return (
                <article key={`${dayLabel}-${idx}`} className="pv-entry">
                  <header className="pv-entry__header">
                    <span className="pv-entry__time">{formatTime(entry.date)}</span>
                    <span className="pv-entry__sentiment" style={{ background: `${meta.color}1F`, color: meta.color }}>
                      <span aria-hidden="true">{meta.emoji}</span>
                      {meta.label}
                    </span>
                  </header>
                  <p className="pv-entry__text">{entry.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MoodTab({ moodTrend, summary }) {
  if (moodTrend.length === 0) {
    return (
      <EmptyCard
        icon="📈"
        title="No mood data yet"
        hint="Mood trends will appear once the patient shares journal entries that have been analyzed for sentiment."
      />
    );
  }

  return (
    <div className="pv-mood">
      <div className="pv-moodSummary">
        <SentimentStat label="Positive" count={summary.counts.positive} total={summary.total} meta={metaFor("positive")} />
        <SentimentStat label="Neutral"  count={summary.counts.neutral}  total={summary.total} meta={metaFor("neutral")} />
        <SentimentStat label="Negative" count={summary.counts.negative} total={summary.total} meta={metaFor("negative")} />
      </div>

      <SentimentChart points={moodTrend} />
    </div>
  );
}

function SentimentStat({ label, count, total, meta }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="pv-statCard">
      <div className="pv-statCard__top">
        <div className="pv-statCard__icon" style={{ background: `${meta.color}1F`, color: meta.color }} aria-hidden="true">
          {meta.emoji}
        </div>
        <div className="pv-statCard__label">{label}</div>
      </div>
      <div className="pv-statCard__num">{count}</div>
      <div className="pv-statCard__pct">
        <div className="pv-statCard__bar">
          <div className="pv-statCard__barFill" style={{ width: `${pct}%`, background: meta.color }} />
        </div>
        <span>{pct}%</span>
      </div>
    </div>
  );
}

function SentimentChart({ points }) {
  const data = points.map((p) => {
    const label = (p.sentiment_label || "").toLowerCase();
    const meta = metaFor(label);
    return {
      y: meta.value,
      label,
      color: meta.color,
      emoji: meta.emoji,
      date: p.date,
    };
  });

  const W = 760, H = 280;
  const PAD_L = 64, PAD_R = 24, PAD_T = 30, PAD_B = 50;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xFor = (i) =>
    data.length === 1
      ? PAD_L + innerW / 2
      : PAD_L + (i / (data.length - 1)) * innerW;

  const yFor = (val) => PAD_T + ((1 - val) / 2) * innerH;

  const linePath = useMemo(() => {
    if (data.length === 0) return "";
    if (data.length === 1) {
      const x = xFor(0), y = yFor(data[0].y);
      return `M ${x} ${y}`;
    }
    const pts = data.map((d, i) => [xFor(i), yFor(d.y)]);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const t = 0.18;
      const c1x = p1[0] + (p2[0] - p0[0]) * t;
      const c1y = p1[1] + (p2[1] - p0[1]) * t;
      const c2x = p2[0] - (p3[0] - p1[0]) * t;
      const c2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
    }
    return d;
  }, [data]);

  const areaPath = useMemo(() => {
    if (!linePath || data.length < 2) return "";
    const lastX = xFor(data.length - 1);
    const firstX = xFor(0);
    const baseline = yFor(-1);
    return `${linePath} L ${lastX} ${baseline} L ${firstX} ${baseline} Z`;
  }, [linePath, data]);

  const tickIndices = useMemo(() => {
    if (data.length <= 5) return data.map((_, i) => i);
    const step = (data.length - 1) / 4;
    return [0, 1, 2, 3, 4].map((i) => Math.round(i * step));
  }, [data]);

  return (
    <div className="pv-chartCard">
      <div className="pv-chartCard__head">
        <h3 className="pv-chartCard__title">Sentiment over time</h3>
        <p className="pv-chartCard__sub">
          {points.length} data point{points.length === 1 ? "" : "s"} from shared entries
        </p>
      </div>

      <div className="pv-chartCard__svgWrap">
        <svg
          className="pv-chartSvg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-label="Sentiment trend chart"
        >
          <defs>
            <linearGradient id="pvAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#6c8fc6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#6c8fc6" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Gridlines + Y-axis labels */}
          <g className="pv-grid">
            {[
              { val: 1,  label: "Positive" },
              { val: 0,  label: "Neutral"  },
              { val: -1, label: "Negative" },
            ].map(({ val, label }) => (
              <g key={val}>
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={yFor(val)}
                  y2={yFor(val)}
                  stroke={val === 0 ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.05)"}
                  strokeWidth="1"
                  strokeDasharray={val === 0 ? "none" : "3 4"}
                />
                <text
                  x={PAD_L - 14}
                  y={yFor(val) + 4}
                  fontSize="11"
                  textAnchor="end"
                  fill="rgba(47,47,47,0.55)"
                  fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
                  fontWeight="600"
                >
                  {label}
                </text>
              </g>
            ))}
          </g>

          {data.length > 1 && <path d={areaPath} fill="url(#pvAreaFill)" />}

          {data.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="#6c8fc6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {data.map((d, i) => (
            <g key={i}>
              <circle cx={xFor(i)} cy={yFor(d.y)} r="7" fill="#fff" stroke={d.color} strokeWidth="2.5" />
              <circle cx={xFor(i)} cy={yFor(d.y)} r="3" fill={d.color} />
            </g>
          ))}

          {/* X-axis labels */}
          <g>
            {tickIndices.map((i) => (
              <text
                key={i}
                x={xFor(i)}
                y={H - PAD_B + 22}
                fontSize="11"
                textAnchor="middle"
                fill="rgba(47,47,47,0.55)"
                fontFamily='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif'
                fontWeight="600"
              >
                {formatShort(data[i].date)}
              </text>
            ))}
          </g>
        </svg>
      </div>

      <div className="pv-chartLegend">
        {[
          { key: "positive", label: "Positive" },
          { key: "neutral",  label: "Neutral"  },
          { key: "negative", label: "Negative" },
        ].map(({ key, label }) => {
          const m = metaFor(key);
          return (
            <div key={key} className="pv-chartLegend__item">
              <span className="pv-chartLegend__dot" style={{ background: m.color }} />
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyCard({ icon, title, hint }) {
  return (
    <div className="pv-empty">
      <div className="pv-empty__icon" aria-hidden="true">{icon}</div>
      <div className="pv-empty__title">{title}</div>
      <div className="pv-empty__hint">{hint}</div>
    </div>
  );
}