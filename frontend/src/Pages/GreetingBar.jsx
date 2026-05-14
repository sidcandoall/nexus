import React from "react";
import "./GreetingBar.css";
import { useAuth } from "../context/Authcontext";

function StatChip({ left, rightLabel }) {
  return (
    <div className="mm-chip">
      <div className="mm-chip__left">{left}</div>
      <div className="mm-chip__right">{rightLabel}</div>
    </div>
  );
}

export default function GreetingBar({
  moodLabel = "Balanced / neutral",
  dayStreak = 0,
  entries = 0,
  stabilityLabel = "Very stable",
  consistencyLabel = "0-day streak",
}) {
  const {user} = useAuth();
  return (
    <section className="mm-greet">
      <div className="mm-greet__inner">
        {/* Top row */}
        <div className="mm-greet__top">
          <h1 className="mm-greet__title">Good afternoon, {user?.name ?? "User"}</h1>

          <div className="mm-moodPill">
            <span className="mm-moodPill__prefix">Today&apos;s mood:</span>
            <span className="mm-moodPill__value"> {moodLabel}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="mm-greet__stats">
          <StatChip left={<span className="mm-chip__num">{dayStreak}</span>} rightLabel="DAY STREAK" />
          <StatChip left={<span className="mm-chip__num">{entries}</span>} rightLabel="ENTRIES" />

          <div className="mm-chip mm-chip--wide">
            <div className="mm-chip__left mm-chip__left--text">{stabilityLabel}</div>
            <div className="mm-chip__right">STABILITY</div>
          </div>

          <div className="mm-chip mm-chip--wide">
            <div className="mm-chip__left mm-chip__left--text">{consistencyLabel}</div>
            <div className="mm-chip__right">CONSISTENCY</div>
          </div>
        </div>
      </div>
    </section>
  );
}