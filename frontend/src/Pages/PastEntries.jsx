import React, { useEffect, useMemo, useState } from "react";
import "./PastEntries.css";
import { checkinAPI } from "../services/api";
import { toast } from "react-hot-toast";

function formatLongDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function getMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const gridStart = new Date(year, month, 1 - startDay);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function moodLabelFromNumber(mood) {
  const map = {
    0: "Awful",
    1: "Awful",
    2: "Bad",
    3: "Meh",
    4: "Good",
    5: "Great",
  };
  return map[mood] ?? "Unknown";
}

function titleFromReflection(reflection) {
  if (!reflection || !reflection.trim()) return "No reflection";
  const firstLine = reflection.split("\n").find((line) => line.trim())?.trim() ?? "No reflection";
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}...` : firstLine;
}

// Map an entry's sentiment + mood to a tone for color-coding the suggestion.
// Returns: "positive" | "negative" | "neutral"
function getSuggestionTone(entry) {
  const s = (entry.sentiment || "").toLowerCase();
  if (s === "positive" || s === "negative" || s === "neutral") {
    return s;
  }
  // Fall back to mood number if sentiment is missing
  if (typeof entry.moodNum === "number") {
    if (entry.moodNum >= 4) return "positive";
    if (entry.moodNum <= 2) return "negative";
    return "neutral";
  }
  return "neutral";
}

function mapCheckinToEntry(checkin, index) {
  const created = new Date(checkin.created_at);
  const validDate = Number.isNaN(created.getTime()) ? new Date() : created;

  return {
    id: checkin.id ?? `entry-${index}`,
    date: toISODate(validDate),
    timeLabel: validDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    moodLabel: moodLabelFromNumber(checkin.mood),
    moodNum: typeof checkin.mood === "number" ? checkin.mood : null,
    sentiment: (checkin.sentiment_label || checkin.sentiment || "").toLowerCase(),
    title: titleFromReflection(checkin.reflection),
    text: checkin.reflection?.trim() || "No reflection text for this entry.",
    createdAtMs: validDate.getTime(),
    sharedWithTherapist: checkin.shared_with_therapist ?? false,
    suggestion: checkin.suggestion?.trim() || "",
  };
}

export default function PastEntries() {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toISODate(new Date()));
  const [selectedEntryId, setSelectedEntryId] = useState(null);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchEntries() {
      setLoading(true);
      setError("");

      try {
        const res = await checkinAPI.getAll(); // expects GET /api/checkins
        const checkins = Array.isArray(res.data) ? res.data : [];
        const mapped = checkins.map(mapCheckinToEntry).sort((a, b) => b.createdAtMs - a.createdAtMs);

        if (!active) return;
        setEntries(mapped);

        if (mapped.length > 0) {
          setSelectedDate(mapped[0].date);
          setSelectedEntryId(mapped[0].id);
        } else {
          setSelectedEntryId(null);
        }
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.detail || "Failed to load past entries.");
        setEntries([]);
        setSelectedEntryId(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchEntries();
    return () => {
      active = false;
    };
  }, []);

  // NEW: Toggle sharing for a single entry
  const toggleEntrySharing = async (entryId, currentValue) => {
    const nextValue = !currentValue;
    // Optimistic update
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId ? { ...e, sharedWithTherapist: nextValue } : e
      )
    );

    try {
      await checkinAPI.toggleSharing(entryId, nextValue);
      toast.success(nextValue ? "Entry shared with therapist" : "Entry no longer shared");
    } catch {
      // Revert on error
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, sharedWithTherapist: currentValue } : e
        )
      );
      toast.error("Could not update sharing preference");
    }
  };

  const entriesByDate = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date).push(e);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => b.createdAtMs - a.createdAtMs);
      map.set(k, arr);
    }
    return map;
  }, [entries]);

  const allEntries = useMemo(() => entries, [entries]);

  const selectedDayEntries = useMemo(() => {
    return entriesByDate.get(selectedDate) ?? [];
  }, [entriesByDate, selectedDate]);

  const selectedEntry = useMemo(() => {
    return allEntries.find((e) => e.id === selectedEntryId) || allEntries[0] || null;
  }, [allEntries, selectedEntryId]);

  useEffect(() => {
    if (selectedDayEntries.length) {
      setSelectedEntryId(selectedDayEntries[0].id);
    }
  }, [selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const monthLabel = useMemo(() => {
    return viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [viewDate]);

  const cells = useMemo(() => getMonthGrid(viewDate), [viewDate]);

  function goPrevMonth() {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() - 1);
    setViewDate(d);
  }

  function goNextMonth() {
    const d = new Date(viewDate);
    d.setMonth(d.getMonth() + 1);
    setViewDate(d);
  }

  return (
    <main className="pe-page">
      <div className="pe-inner">
        <div className="pe-layout">
          <section className="pe-left">
            <div className="pe-card pe-calendarCard">
              <div className="pe-calHeader">
                <button className="pe-calNav" onClick={goPrevMonth} aria-label="Previous month">
                  ‹
                </button>
                <div className="pe-calTitle">{monthLabel}</div>
                <button className="pe-calNav" onClick={goNextMonth} aria-label="Next month">
                  ›
                </button>
              </div>

              <div className="pe-dow">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                  <div key={d} className="pe-dowCell">
                    {d}
                  </div>
                ))}
              </div>

              <div className="pe-grid">
                {cells.map((d) => {
                  const iso = toISODate(d);
                  const inMonth = sameMonth(d, viewDate);
                  const isSelected = iso === selectedDate;
                  const hasEntries = entriesByDate.has(iso);

                  return (
                    <button
                      key={iso}
                      type="button"
                      className={["pe-day", inMonth ? "" : "is-out", isSelected ? "is-selected" : ""].join(" ")}
                      onClick={() => setSelectedDate(iso)}
                      aria-label={`Select ${iso}`}
                    >
                      <span className="pe-dayNum">{d.getDate()}</span>
                      {hasEntries ? <span className="pe-dot" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pe-card pe-listCard">
              <div className="pe-listHeader">
                <div className="pe-listTitle">All entries</div>
                <div className="pe-listSub">
                  {allEntries.length ? `${allEntries.length} entr${allEntries.length === 1 ? "y" : "ies"}` : "No entries"}
                </div>
              </div>

              {loading ? (
                <div className="pe-emptyList">Loading entries...</div>
              ) : error ? (
                <div className="pe-emptyList">{error}</div>
              ) : allEntries.length ? (
                <div className="pe-entryList">
                  {allEntries.map((e) => {
                    const active = e.id === (selectedEntry?.id ?? null);
                    return (
                      <div key={e.id} className={`pe-entryRow-wrapper ${active ? "is-active" : ""}`}>
                        <button
                          type="button"
                          className={`pe-entryRow ${active ? "is-active" : ""}`}
                          onClick={() => {
                            setSelectedEntryId(e.id);
                            setSelectedDate(e.date);
                          }}
                        >
                          <div className="pe-entryRow__top">
                            <span className="pe-time">{formatLongDate(e.date)}</span>
                          </div>
                          <div className="pe-entryRow__top">
                            {/* <span className="pe-time">{e.timeLabel}</span> */}
                            <span className="pe-mood">{e.moodLabel}</span>
                          </div>
                          <div className="pe-entryRow__title">{e.title}</div>
                        </button>

                        {/* NEW: Toggle button on each card */}
                        <button
                          type="button"
                          className={`pe-share-toggle ${e.sharedWithTherapist ? "is-on" : ""}`}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleEntrySharing(e.id, e.sharedWithTherapist);
                          }}
                          aria-label={e.sharedWithTherapist ? "Stop sharing this entry" : "Share this entry with therapist"}
                          title={e.sharedWithTherapist ? "Shared with therapist — click to unshare" : "Not shared — click to share with therapist"}
                        >
                          <span className="pe-share-toggle__track">
                            <span className="pe-share-toggle__thumb" />
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="pe-emptyList">No entries found</div>
              )}
            </div>
          </section>

          <section className="pe-right">
            <div className="pe-card pe-detailCard">
              <div className="pe-detailHeader">
                <div className="pe-detailDate">
                  {selectedEntry ? formatLongDate(selectedEntry.date) : formatLongDate(selectedDate)}
                </div>
              </div>

              {selectedEntry ? (
                <article className="pe-detailBody">
                  <div className="pe-detailMeta">
                    {/* <span className="pe-detailTime">{selectedEntry.timeLabel}</span> */}
                    {/* <span className="pe-detailMood">{selectedEntry.moodLabel}</span> */}
                    {/* NEW: Indicator badge */}
                    {selectedEntry.sharedWithTherapist && (
                      <span className="pe-shared-badge">
                        Shared with therapist
                      </span>
                    )}
                  </div>

                  <h2 className="pe-detailTitle">{selectedEntry.title}</h2>
                  <div className="pe-paper">
                    <p className="pe-detailText">{selectedEntry.text}</p>
                  </div>

                  {selectedEntry.suggestion && (
                    <div className={`pe-suggestion pe-suggestion--${getSuggestionTone(selectedEntry)}`}>
                      <div className="pe-suggestion__header">
                        <span className="pe-suggestion__icon" aria-hidden="true">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 3a7 7 0 0 0-4 12.7V18a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 3Z"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M9.5 21h5"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        <span className="pe-suggestion__label">Suggestion</span>
                      </div>
                      <p className="pe-suggestion__text">{selectedEntry.suggestion}</p>
                    </div>
                  )}
                </article>
              ) : (
                <div className="pe-detailEmpty">No entry selected.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}