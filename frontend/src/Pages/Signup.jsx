import React, { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/Authcontext";
import { authAPI } from "../services/api";
import "./Signup.css";
import Navbar from "./Navbar";

/* ── Password strength scorer ─────────────────────────────────────────────
   Returns { score: 0|1|2, label: string, color: string }
   0 = Weak  (< 2 criteria)
   1 = Fair  (2–3 criteria)
   2 = Strong (4–5 criteria)
────────────────────────────────────────────────────────────────────────── */
function getPasswordStrength(pwd) {
  if (!pwd) return null;
  const checks = [
    pwd.length >= 8,                    // length
    /[A-Z]/.test(pwd),                  // uppercase
    /[a-z]/.test(pwd),                  // lowercase
    /[0-9]/.test(pwd),                  // number
    /[^A-Za-z0-9]/.test(pwd),           // special char
  ];
  const passed = checks.filter(Boolean).length;

  if (passed <= 2) return { score: 0, label: "Weak",   color: "var(--pw-weak,   #e53e3e)" };
  if (passed <= 3) return { score: 1, label: "Fair",   color: "var(--pw-fair,   #dd6b20)" };
                   return { score: 2, label: "Strong", color: "var(--pw-strong, #38a169)" };
}

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [fullName, setFullName]         = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner]             = useState("");
  const [loading, setLoading]           = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  function validate() {
    if (!fullName.trim())                 return "Full name is required.";
    if (!email.trim())                    return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(email))     return "Enter a valid email address.";
    if (!password)                        return "Password is required.";
    if (password.length < 6)             return "Password must be at least 6 characters.";
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate();
    if (err) { setBanner(err); return; }
    setBanner("");
    setLoading(true);

    try {
      const res = await authAPI.register({ name: fullName, email, password });
      const { access_token, user } = res.data;
      login(access_token, user);
      toast.success(`Account created! Welcome, ${user.name}!`);
      navigate("/journal", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;

      if (status === 409) {
        setBanner("An account with this email already exists. Try logging in.");
      } else if (status === 422) {
        setBanner(detail || "Please check your details and try again.");
      } else if (status === 429) {
        setBanner("Too many attempts. Please wait a moment and try again.");
      } else if (status >= 500) {
        setBanner("Server error. Please try again later.");
      } else {
        setBanner(detail || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar variant="auth" />

      <main className="signup-page">
        <div className="signup-shell">
          <section className="signup-main">
            <div className="signup-heading">
              <h1 className="signup-heading__title">Sign Up</h1>
              <p className="signup-heading__subtitle">Create A New Mind Mirror Account</p>
            </div>

            <form className="signup-form" onSubmit={handleSubmit} noValidate>

              {/* ── Error banner ── */}
              {banner && (
                <div className="signup-banner signup-banner--error" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="currentColor" strokeWidth="0.8" />
                  </svg>
                  <span>{banner}</span>
                </div>
              )}

              {/* ── Full Name ── */}
              <div className="signup-fieldGroup">
                <label className="signup-label" htmlFor="fullName">Full Name</label>
                <div className="signup-inputWrap">
                  <span className="signup-inputIcon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M5.5 18.2C6.6 15.6 9 14.4 12 14.4C15 14.4 17.4 15.6 18.5 18.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    id="fullName"
                    type="text"
                    className="signup-input"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); setBanner(""); }}
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* ── Email ── */}
              <div className="signup-fieldGroup">
                <label className="signup-label" htmlFor="email">Email</label>
                <div className="signup-inputWrap">
                  <span className="signup-inputIcon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M5 7L12 12.5L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    className="signup-input"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setBanner(""); }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* ── Password ── */}
              <div className="signup-fieldGroup">
                <label className="signup-label" htmlFor="password">Password</label>
                <div className="signup-inputWrap">
                  <span className="signup-inputIcon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="5.5" y="10" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M8 10V7.8C8 5.7 9.7 4 11.8 4C13.9 4 15.6 5.7 15.6 7.8V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="12" cy="15" r="1.2" fill="currentColor" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="signup-input signup-input--password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setBanner(""); }}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                  />
                  <button
                    type="button"
                    className="signup-showBtn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M2.5 12C4.4 8.5 7.7 6.5 12 6.5C16.3 6.5 19.6 8.5 21.5 12C19.6 15.5 16.3 17.5 12 17.5C7.7 17.5 4.4 15.5 2.5 12Z" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </button>
                </div>

                {/* ── Password strength bar ── */}
                {strength && (
                  <div className="signup-strength" aria-live="polite">
                    <div className="signup-strength__bar">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="signup-strength__segment"
                          style={{
                            backgroundColor: i <= strength.score ? strength.color : undefined,
                            opacity: i <= strength.score ? 1 : 0.2,
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="signup-strength__label"
                      style={{ color: strength.color }}
                    >
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className={`signup-submit ${loading ? "is-loading" : ""}`}
                disabled={loading}
              >
                {loading ? "Creating account…" : "Sign Up"}
              </button>

              <p className="signup-loginText">
                Already have an account?{" "}
                <NavLink to="/login" className="signup-link signup-link--strong">
                  Log In
                </NavLink>
              </p>
            </form>
          </section>
        </div>

        <footer className="signup-footer">
          <p className="signup-footer__text">
            By signing up you agree to our{" "}
            <a href="#" className="signup-footer__link">Terms of Services</a>{" "}
            &{" "}
            <a href="#" className="signup-footer__link">Privacy Policy</a>
          </p>
        </footer>
      </main>
    </>
  );
}