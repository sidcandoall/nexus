/**
 * TherapistSharing.jsx
 *
 * Patient-facing settings panel for managing therapist access.
 *
 * API (all require x-user-id + x-user-role: patient headers):
 *   GET    /api/sharing/status          → { links, sharing_enabled }
 *   PATCH  /api/sharing/enabled         → { patient_id, sharing_enabled }
 *   POST   /api/sharing/link            → { linked, therapist_id }
 *   DELETE /api/sharing/link/:id        → { unlinked, therapist_id }
 *
 * Drop-in usage:
 *   1. Add route in App.jsx:  <Route path="/settings" element={<TherapistSharing />} />
 *   2. Add tab in Navbar.jsx: { label: "Settings", to: "/settings" }
 */

import React, { useCallback, useEffect, useState } from "react";
import api from "../services/api"; // axios instance with baseURL http://localhost:8000/api

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const sharingAPI = {
  getStatus: () => api.get("/sharing/status"),
  setEnabled: (enabled) =>
    api.patch("/sharing/enabled", { sharing_enabled: enabled }),
  link: (therapist_id) => api.post("/sharing/link", { therapist_id }),
  unlink: (therapist_id) => api.delete(`/sharing/link/${therapist_id}`),
};

function fmt(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (scoped via .ts- prefix; matches MindMirror design tokens)
// ─────────────────────────────────────────────────────────────────────────────

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap');

.ts-wrap { width:100%; background:#fbfaf7; min-height:100vh; }
.ts-inner { max-width:760px; margin:0 auto; padding:32px 24px 64px; }

/* typography */
.ts-h1 {
  font-family:'Playfair Display',ui-serif,Georgia,serif;
  font-size:24px; font-weight:700; color:#2f2f2f; margin:0 0 4px;
}
.ts-sub {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:14px; color:#6f7a80; margin:0 0 28px;
}
.ts-label {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:11px; font-weight:700; letter-spacing:.6px;
  text-transform:uppercase; color:#6f7a80;
}

/* cards */
.ts-card {
  border-radius:18px; border:1px solid rgba(0,0,0,.08);
  padding:22px 24px; margin-bottom:16px; background:#fff;
}
.ts-card--tinted { background:#fbf4ee; }

/* notice banner */
.ts-notice {
  display:flex; gap:12px; align-items:flex-start;
  background:rgba(108,143,198,.09); border:1px solid rgba(108,143,198,.2);
  border-radius:14px; padding:14px 16px; margin-bottom:24px;
}
.ts-notice__icon {
  flex-shrink:0; width:34px; height:34px; border-radius:10px;
  background:rgba(108,143,198,.18); display:grid; place-items:center;
  color:#6c8fc6;
}
.ts-notice__text {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:13.5px; line-height:1.55; color:#4f5a61;
}
.ts-notice__text b { font-weight:700; color:#2f2f2f; }

/* global toggle row */
.ts-master {
  display:flex; align-items:center; justify-content:space-between; gap:16px;
}
.ts-master__copy { flex:1; }
.ts-master__title {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:15px; font-weight:700; color:#2f2f2f; margin:0 0 3px;
}
.ts-master__desc {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:13px; color:#6f7a80; margin:0;
}

/* toggle switch */
.ts-toggle { position:relative; display:inline-block; width:48px; height:27px; flex-shrink:0; }
.ts-toggle input { opacity:0; width:0; height:0; }
.ts-toggle__track {
  position:absolute; inset:0; border-radius:999px;
  background:rgba(0,0,0,.15); transition:background 200ms ease; cursor:pointer;
}
.ts-toggle input:checked + .ts-toggle__track { background:#6c8fc6; }
.ts-toggle__thumb {
  position:absolute; top:3px; left:3px; width:21px; height:21px;
  border-radius:50%; background:#fff;
  box-shadow:0 1px 4px rgba(0,0,0,.2);
  transition:transform 200ms cubic-bezier(.34,1.3,.64,1);
  pointer-events:none;
}
.ts-toggle input:checked ~ .ts-toggle__thumb { transform:translateX(21px); }

/* link form */
.ts-form { display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-top:14px; }
.ts-field { flex:1; min-width:200px; }
.ts-field label { display:block; margin-bottom:6px; }
.ts-input {
  width:100%; border:1px solid rgba(0,0,0,.12); border-radius:10px;
  padding:10px 14px; font-size:14px; color:#2f2f2f;
  background:rgba(255,255,255,.9); box-sizing:border-box; outline:none;
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
}
.ts-input:focus {
  border-color:rgba(108,143,198,.5);
  box-shadow:0 0 0 3px rgba(108,143,198,.13);
}

/* buttons */
.ts-btn {
  border:none; border-radius:999px; padding:10px 20px;
  font-size:14px; font-weight:700; cursor:pointer; white-space:nowrap;
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  transition:filter 120ms;
}
.ts-btn:hover:not(:disabled) { filter:brightness(.96); }
.ts-btn:disabled { opacity:.45; cursor:not-allowed; }
.ts-btn--primary { background:#6c8fc6; color:#fff; }
.ts-btn--danger  { background:transparent; color:#c0392b; border:1px solid rgba(192,57,43,.3); padding:8px 14px; font-size:13px; }

/* flash message */
.ts-flash { border-radius:9px; padding:8px 13px; margin-top:10px; font-size:13px;
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif; }
.ts-flash--ok  { background:rgba(98,168,142,.13); color:#2d7f5e; }
.ts-flash--err { background:rgba(192,57,43,.10);  color:#c0392b; }

/* link list */
.ts-list { display:flex; flex-direction:column; gap:10px; margin-top:14px; }
.ts-item {
  display:flex; align-items:center; gap:12px;
  background:rgba(255,255,255,.8); border:1px solid rgba(0,0,0,.07);
  border-radius:13px; padding:14px 16px;
}
.ts-item__avatar {
  width:40px; height:40px; border-radius:11px; flex-shrink:0;
  background:rgba(108,143,198,.14); display:grid; place-items:center; color:#6c8fc6;
}
.ts-item__info { flex:1; min-width:0; }
.ts-item__id {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:14px; font-weight:700; color:#2f2f2f; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap;
}
.ts-item__meta {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:12px; color:#6f7a80; margin-top:2px;
}
.ts-item__inactive { font-size:12px; color:#b0b8be; font-style:italic; }
.ts-empty {
  text-align:center; padding:28px 16px; color:rgba(47,47,47,.4);
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:14px;
}
.ts-empty__icon { font-size:30px; margin-bottom:8px; }

/* what they can see */
.ts-perms { display:flex; flex-direction:column; gap:10px; }
.ts-perm { display:flex; gap:10px; align-items:flex-start; }
.ts-perm__icon { font-size:17px; line-height:1.3; flex-shrink:0; }
.ts-perm__title {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:14px; font-weight:700; color:#2f2f2f;
}
.ts-perm__desc {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:13px; color:#6f7a80; margin-top:2px;
}
.ts-divider { height:1px; background:rgba(0,0,0,.07); margin:18px 0; }
.ts-section-title {
  font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:15px; font-weight:700; color:#2f2f2f; margin:0 0 4px;
}

@media(max-width:560px){
  .ts-form  { flex-direction:column; }
  .ts-item  { flex-wrap:wrap; }
  .ts-inner { padding:24px 16px 48px; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function TherapistSharing() {
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [therapistId, setTherapistId] = useState("");
  const [linking, setLinking] = useState(false);

  const [flash, setFlash] = useState(null); // { type: "ok"|"err", msg }

  const showFlash = (type, msg) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 3500);
  };

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sharingAPI.getStatus();
      setSharingEnabled(res.data.sharing_enabled ?? false);
      setLinks(res.data.links ?? []);
    } catch {
      showFlash("err", "Could not load sharing settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Global toggle ─────────────────────────────────────────────────────────
  const handleMasterToggle = async (next) => {
    setSharingEnabled(next); // optimistic
    try {
      await sharingAPI.setEnabled(next);
      showFlash("ok", next ? "Sharing enabled." : "Sharing paused — therapists cannot view your data.");
    } catch {
      setSharingEnabled(!next); // revert
      showFlash("err", "Could not update sharing preference.");
    }
  };

  // ── Link a therapist ──────────────────────────────────────────────────────
  const handleLink = async () => {
    const id = therapistId.trim();
    if (!id) return;
    if (links.some((l) => l.therapist_id === id && l.active)) {
      showFlash("err", "Already linked to this therapist.");
      return;
    }
    setLinking(true);
    try {
      await sharingAPI.link(id);
      setTherapistId("");
      showFlash("ok", "Therapist linked successfully.");
      await load();
    } catch {
      showFlash("err", "Could not link therapist — please check the ID.");
    } finally {
      setLinking(false);
    }
  };

  // ── Unlink ────────────────────────────────────────────────────────────────
  const handleUnlink = async (id) => {
    try {
      await sharingAPI.unlink(id);
      showFlash("ok", "Therapist removed.");
      await load();
    } catch {
      showFlash("err", "Could not remove therapist.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <div className="ts-wrap">
        <div className="ts-inner">

          {/* Page header */}
          <h1 className="ts-h1">Therapist Access</h1>
          <p className="ts-sub">
            Control which therapists can see your journal entries and mood data.
          </p>

          {/* Privacy notice */}
          <div className="ts-notice">
            <div className="ts-notice__icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2Zm0 5v4m0 4h.01"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="ts-notice__text">
              <b>You stay in control.</b> Therapists can only view your data when
              sharing is switched on below. You can pause or revoke access at any time,
              and changes take effect immediately.
            </p>
          </div>

          {/* ── Global sharing toggle ─────────────────────────────────────── */}
          <div className="ts-card ts-card--tinted">
            <div className="ts-master">
              <div className="ts-master__copy">
                <p className="ts-master__title">Share with linked therapists</p>
                <p className="ts-master__desc">
                  {sharingEnabled
                    ? "Your therapists can currently view your journal and mood data."
                    : "Sharing is paused — no therapist can view your data right now."}
                </p>
              </div>

              <label className="ts-toggle" aria-label="Toggle data sharing">
                <input
                  type="checkbox"
                  checked={sharingEnabled}
                  disabled={loading}
                  onChange={(e) => handleMasterToggle(e.target.checked)}
                />
                <span className="ts-toggle__track" />
                <span className="ts-toggle__thumb" />
              </label>
            </div>
          </div>

          {/* ── Link a therapist ──────────────────────────────────────────── */}
          <div className="ts-card">
            <p className="ts-section-title">Add a therapist</p>
            <p className="ts-master__desc" style={{ marginTop: 2 }}>
              Ask your therapist for their MindMirror therapist ID and enter it below.
            </p>

            <div className="ts-form">
              <div className="ts-field">
                <label className="ts-label" htmlFor="ts-therapist-id">
                  Therapist ID
                </label>
                <input
                  id="ts-therapist-id"
                  className="ts-input"
                  type="text"
                  placeholder="e.g. therapist_abc123"
                  value={therapistId}
                  onChange={(e) => setTherapistId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLink()}
                />
              </div>
              <button
                className="ts-btn ts-btn--primary"
                onClick={handleLink}
                disabled={linking || !therapistId.trim()}
              >
                {linking ? "Linking…" : "Link therapist"}
              </button>
            </div>

            {flash && (
              <div className={`ts-flash ts-flash--${flash.type}`}>{flash.msg}</div>
            )}
          </div>

          {/* ── Linked therapist list ─────────────────────────────────────── */}
          <div className="ts-card">
            <p className="ts-section-title">Linked therapists</p>

            {loading ? (
              <div className="ts-empty">Loading…</div>
            ) : links.length === 0 ? (
              <div className="ts-empty">
                <div className="ts-empty__icon">🔒</div>
                <div>No therapists linked yet.</div>
              </div>
            ) : (
              <div className="ts-list">
                {links.map((link) => (
                  <div key={link.therapist_id} className="ts-item">
                    <div className="ts-item__avatar" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6"/>
                        <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
                          stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    </div>

                    <div className="ts-item__info">
                      <div className="ts-item__id">{link.therapist_id}</div>
                      <div className="ts-item__meta">
                        {link.active ? (
                          <>
                            {link.linked_at ? `Linked ${fmt(link.linked_at)}` : "Active link"}
                            {!sharingEnabled && (
                              <span style={{ color: "#c0392b", marginLeft: 6 }}>
                                · sharing paused
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="ts-item__inactive">Deactivated</span>
                        )}
                      </div>
                    </div>

                    {link.active && (
                      <button
                        className="ts-btn ts-btn--danger"
                        onClick={() => handleUnlink(link.therapist_id)}
                        aria-label={`Remove ${link.therapist_id}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── What they can see ─────────────────────────────────────────── */}
          <div className="ts-card">
            <p className="ts-section-title">What your therapist can see</p>
            <div className="ts-divider" />
            <div className="ts-perms">
              {[
                { icon: "📓", title: "Journal entries", desc: "Your written reflections in chronological order." },
                { icon: "📈", title: "Mood trend", desc: "Sentiment analysis over time — positive, negative, neutral labels and confidence scores." },
              ].map((p) => (
                <div key={p.title} className="ts-perm">
                  <span className="ts-perm__icon">{p.icon}</span>
                  <div>
                    <div className="ts-perm__title">{p.title}</div>
                    <div className="ts-perm__desc">{p.desc}</div>
                  </div>
                </div>
              ))}

              <div className="ts-divider" />

              <div className="ts-perm" style={{ opacity: 0.55 }}>
                <span className="ts-perm__icon">🔒</span>
                <div>
                  <div className="ts-perm__title">What stays private</div>
                  <div className="ts-perm__desc">
                    Your account credentials, anything you delete, and all data
                    when sharing is switched off.
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
