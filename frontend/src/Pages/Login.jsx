import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/Authcontext";
import { authAPI } from "../services/api";
import "./Login.css";
import Navbar from "./Navbar";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [banner, setBanner]             = useState("");
  const [loading, setLoading]           = useState(false);

  function validate() {
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
      const res = await authAPI.login({ email, password });
      const { access_token, user } = res.data;
      console.log(user.role);
      login(access_token, user);
 
      // ── Store role for navbar/redirect logic ─────────────────────────────
      localStorage.setItem("mindmirror:role", user.role);
 
      toast.success(`Welcome back, ${user.name}!`);
 
      // ── Role-based redirect ──────────────────────────────────────────────
      const target = user.role === "therapist" ? "/therapist/dashboard" : "/journal";
      navigate(target, { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
 
      if (status === 401) {
        setBanner("Invalid email or password. Please try again.");
      } else if (status === 403) {
        setBanner("Your account has been disabled. Please contact support.");
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
      <main className="login-page">
        <div className="login-shell">
          <section className="login-main">
            <div className="login-heading">
              <h2 className="login-heading__title">Welcome Back</h2>
              <p className="login-heading__subtitle">Sign in to continue your reflection journey</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>

              {/* ── Error banner ── */}
              {banner && (
                <div className="login-banner login-banner--error" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="currentColor" strokeWidth="0.8" />
                  </svg>
                  <span>{banner}</span>
                </div>
              )}

              {/* ── Email ── */}
              <div className="login-fieldGroup">
                <label className="login-label" htmlFor="email">Email</label>
                <div className="login-inputWrap">
                  <span className="login-inputIcon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M5 7L12 12.5L19 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    className="login-input"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setBanner(""); }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* ── Password ── */}
              <div className="login-fieldGroup">
                <label className="login-label" htmlFor="password">Password</label>
                <div className="login-inputWrap">
                  <span className="login-inputIcon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect x="5.5" y="10" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M8 10V7.8C8 5.7 9.7 4 11.8 4C13.9 4 15.6 5.7 15.6 7.8V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="12" cy="15" r="1.2" fill="currentColor" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="login-input login-input--password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setBanner(""); }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-showBtn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M2.5 12C4.4 8.5 7.7 6.5 12 6.5C16.3 6.5 19.6 8.5 21.5 12C19.6 15.5 16.3 17.5 12 17.5C7.7 17.5 4.4 15.5 2.5 12Z" stroke="currentColor" strokeWidth="1.8" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className={`login-submit ${loading ? "is-loading" : ""}`}
                disabled={loading}
              >
                {loading ? "Signing in…" : "Log In"}
              </button>

              <p className="login-signupText">
                Don&apos;t have an account?{" "}
                <NavLink to="/signup" className="login-link login-link--strong">
                  Sign Up
                </NavLink>
              </p>
            </form>
          </section>
        </div>

        <footer className="login-footer">
          <p className="login-footer__text">
            By logging in you agree to our{" "}
            <a href="#" className="login-footer__link">Terms of Services</a>{" "}
            &{" "}
            <a href="#" className="login-footer__link">Privacy Policy</a>
          </p>
        </footer>
      </main>
    </>
  );
}