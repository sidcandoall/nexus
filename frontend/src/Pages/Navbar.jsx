import React from "react";
import "./Navbar.css";
import logo from "../assets/logo3.png";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/Authcontext";

export default function Navbar({
  onToggleTheme = () => {},
  variant = "full",
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const role = localStorage.getItem("mindmirror:role") || "patient";
  
  const tabs =
    role === "therapist"
      ? [{ label: "My Patients", to: "/therapist/dashboard" }]  // Fixed route
      : [
          { label: "Journal", to: "/journal" },
          { label: "Insights", to: "/insights" },
          { label: "Past Entries", to: "/past-entries" },
          { label: "Settings", to: "/settings" },
        ];

  return (
    <header className="mm-navbar">
      <div className="mm-navbar__inner">
        
        {/* Left: Brand */}
        <div className="mm-brand">
          <NavLink to="/journal" className="mm-brand__clickable">
            <img src={logo} alt="Mind Mirror logo" className="mm-brand__logoImg" />
            <span className="mm-brand__name">Mind Mirror</span>
          </NavLink>
        </div>

        {/* Center: Tabs */}
        {variant === "full" && (
          <nav className="mm-tabs" aria-label="Primary">
            {tabs.map((t) => (
              <NavLink
                key={t.label}
                to={t.to}
                className="mm-tab"
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Right */}
        {variant === "full" && (
          <div className="mm-actions">
            <div className="mm-userpill">{user?.name ?? "User"}</div>

            <button
              className="mm-iconbtn"
              onClick={onToggleTheme}
              type="button"
              aria-label="Toggle theme"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 14.5C19.7 15.1 18.2 15.5 16.6 15.5C11.5 15.5 7.5 11.5 7.5 6.4C7.5 4.8 7.9 3.3 8.5 2C5.3 3.3 3 6.4 3 10.1C3 15 7 19 11.9 19C15.6 19 18.7 16.7 21 14.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <button className="mm-logout" onClick={handleLogout} type="button">
              Logout
            </button>
          </div>
        )}
      </div>

      <div className="mm-navbar__dividerWrapper">
        <div className="mm-navbar__divider" />
      </div>
    </header>
  );
}