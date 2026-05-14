import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./TherapistDashboard.css";
import api from "../services/api";
import { useAuth } from "../context/Authcontext";

export default function TherapistDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    async function fetchPatients() {
      try {
        const res = await api.get("/therapist/patients");
        if (!active) return;
        setPatients(res.data.patients || []);
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.detail || "Could not load your patients.");
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchPatients();
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = patients.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
      );
    });
    return list.sort((a, b) => {
      if (a.sharing_enabled !== b.sharing_enabled) {
        return a.sharing_enabled ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [patients, search]);

  const stats = useMemo(() => {
    const total = patients.length;
    const sharing = patients.filter((p) => p.sharing_enabled).length;
    return { total, sharing, paused: total - sharing };
  }, [patients]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  return (
    <main className="td-page">
      <div className="td-inner">

        {/* Greeting header */}
        <section className="td-greet">
          <div className="td-greet__top">
            <h1 className="td-greet__title">
              {greeting}, {user?.name ?? "Doctor"}
            </h1>
            <div className="td-rolePill">
              <span className="td-rolePill__dot" />
              Therapist
            </div>
          </div>

          <div className="td-greet__stats">
            <StatChip num={stats.total} label="TOTAL PATIENTS" />
            <StatChip num={stats.sharing} label="ACTIVELY SHARING" tone="ok" />
            <StatChip num={stats.paused} label="SHARING PAUSED" tone="muted" />
          </div>
        </section>

        {/* Patients section header */}
        <div className="td-listHeader">
          <div>
            <h2 className="td-listTitle">Your patients</h2>
            <p className="td-listSubtitle">
              Click a patient to view their journal entries and mood trends
            </p>
          </div>

          <div className="td-searchWrap">
            <svg
              className="td-searchIcon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="m20 20-3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              className="td-search"
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="td-skeletonGrid">
            {[1, 2, 3].map((i) => (
              <div key={i} className="td-skeleton" />
            ))}
          </div>
        ) : error ? (
          <div className="td-error">{error}</div>
        ) : patients.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No patients linked yet"
            hint="Share your therapist ID with patients so they can link from their Settings page."
            extra={
              user?.id ? (
                <div className="td-idCard">
                  <span className="td-idCard__label">Your therapist ID</span>
                  <code className="td-idCard__value">{user.id}</code>
                </div>
              ) : null
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No matches"
            hint={`No patient matches "${search}". Try a different search.`}
          />
        ) : (
          <div className="td-grid">
            {filtered.map((p) => (
              <PatientCard
                key={p.patient_id}
                patient={p}
                onOpen={() => navigate(`/therapist/patient/${p.patient_id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatChip({ num, label, tone = "default" }) {
  return (
    <div className={`td-chip td-chip--${tone}`}>
      <div className="td-chip__num">{num}</div>
      <div className="td-chip__label">{label}</div>
    </div>
  );
}

function PatientCard({ patient, onOpen }) {
  const initials = (patient.name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <button
      type="button"
      className={`td-card ${patient.sharing_enabled ? "" : "is-paused"}`}
      onClick={onOpen}
      aria-label={`Open ${patient.name}'s data`}
    >
      <div className="td-card__top">
        <div className="td-card__avatar" aria-hidden="true">
          {initials || "?"}
        </div>
        <div
          className={`td-card__status ${
            patient.sharing_enabled ? "is-on" : "is-off"
          }`}
        >
          <span className="td-card__statusDot" />
          {patient.sharing_enabled ? "Sharing" : "Paused"}
        </div>
      </div>

      <div className="td-card__body">
        <div className="td-card__name">{patient.name}</div>
        <div className="td-card__email">{patient.email}</div>
      </div>

      <div className="td-card__footer">
        <span className="td-card__cta">
          {patient.sharing_enabled ? "View entries" : "Limited access"}
        </span>
        <span className="td-card__arrow" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12h14m-6-6 6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </button>
  );
}

function EmptyState({ icon, title, hint, extra }) {
  return (
    <div className="td-empty">
      <div className="td-empty__icon" aria-hidden="true">{icon}</div>
      <div className="td-empty__title">{title}</div>
      <div className="td-empty__hint">{hint}</div>
      {extra}
    </div>
  );
}