import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { setAuthToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);  // { id, name, email }
  const [token, setToken] = useState(null);  // JWT string, in-memory only

  const login = useCallback((tokenStr, userObj) => {
    setAuthToken(tokenStr);
    setToken(tokenStr);
    setUser(userObj);
    localStorage.setItem("mindmirror:userId", userObj?.id || "patient-demo-1");
    localStorage.setItem("mindmirror:role", userObj.role || "patient");
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem("mindmirror:userId");
    localStorage.removeItem("mindmirror:role");
  }, []);

  const value = useMemo(
    () => ({ user, token, login, logout, isAuthenticated: !!token }),
    [user, token, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}