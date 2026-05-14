import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import MoodTrendChart from "./MoodTrendChart";
import { therapistAPI } from "../services/api";

export default function PatientDetail() {
  const { patientId } = useParams();
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [trendPoints, setTrendPoints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [sharingOffMessage, setSharingOffMessage] = useState("");

  useEffect(() => {
    const previousRole = localStorage.getItem("mindmirror:role");
    const previousUserId = localStorage.getItem("mindmirror:userId");

    localStorage.setItem("mindmirror:role", "therapist");
    localStorage.setItem("mindmirror:userId", previousUserId || "therapist-demo-1");

    let mounted = true;

    async function loadPatientDetails() {
      setIsLoading(true);
      setErrorMessage("");
      setSharingOffMessage("");
      try {
        const [profileResponse, entriesResponse, trendResponse] = await Promise.all([
          therapistAPI.patientProfile(patientId),
          therapistAPI.patientJournal(patientId),
          therapistAPI.patientMood(patientId),
        ]);

        if (!mounted) return;
        setProfile(profileResponse.data);
        setEntries(entriesResponse.data?.entries || []);
        setTrendPoints(trendResponse.data?.points || []);
      } catch (error) {
        if (!mounted) return;
        const detail = error?.response?.data?.detail || "Could not load patient details.";
        if (error?.response?.status === 403 && String(detail).includes("not shared")) {
          setSharingOffMessage("This patient has not shared their data with you.");
          return;
        }
        setErrorMessage(detail);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadPatientDetails();
    return () => {
      mounted = false;
      if (previousRole) {
        localStorage.setItem("mindmirror:role", previousRole);
      } else {
        localStorage.removeItem("mindmirror:role");
      }
      if (previousUserId) {
        localStorage.setItem("mindmirror:userId", previousUserId);
      } else {
        localStorage.removeItem("mindmirror:userId");
      }
    };
  }, [patientId]);

  if (isLoading) {
    return <main style={{ padding: "24px" }}>Loading patient details…</main>;
  }

  if (sharingOffMessage) {
    return (
      <main style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
        <h2>Patient Detail</h2>
        <p>{sharingOffMessage}</p>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto" }}>
        <h2>Patient Detail</h2>
        <p>{errorMessage}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      <h2>Patient Detail</h2>

      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "14px",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontWeight: 700 }}>{profile?.name || "Unknown Patient"}</div>
        <div style={{ color: "#6b7280" }}>{profile?.email || "unknown@example.com"}</div>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: "12px",
          padding: "14px",
          marginBottom: "14px",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Journal Entries</h3>
        <div style={{ maxHeight: "280px", overflowY: "auto", display: "grid", gap: "10px" }}>
          {entries.length ? (
            entries.map((entry, index) => (
              <article
                key={`${entry.date}-${index}`}
                style={{ border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px" }}
              >
                <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  {new Date(entry.date).toLocaleString()} • {entry.sentiment_label}
                </div>
                <p style={{ margin: "6px 0 0" }}>{entry.text || "(No text)"}</p>
              </article>
            ))
          ) : (
            <p>No journal entries available.</p>
          )}
        </div>
      </section>

      <MoodTrendChart points={trendPoints} title="Patient Mood Trend" showPending={false} />
    </main>
  );
}
