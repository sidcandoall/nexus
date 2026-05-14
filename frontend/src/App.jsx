import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./Pages/Navbar";

import Journal from "./Pages/Journal";
import Insights from "./Pages/Insights";
import PastEntries from "./Pages/PastEntries";
import Login from "./Pages/Login";
import Signup from "./Pages/Signup";
import TherapistDashboard from "./Pages/TherapistDashboard";
import PatientView from "./Pages/PatientView";
import TherapistSharing from "./Pages/TherapistSharing";
import { Toaster } from "react-hot-toast";

import { AuthProvider, useAuth } from "./context/Authcontext";

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// NEW: Role-aware default redirect
function DefaultRedirect() {
  const role = localStorage.getItem("mindmirror:role") || "patient";
  const target = role === "therapist" ? "/therapist/dashboard" : "/journal";
  return <Navigate to={target} replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  const role = localStorage.getItem("mindmirror:role") || "patient";

  return (
    <div style={{ minHeight: "100vh", background: "#fbfaf7" }}>
      <Toaster />
      {isAuthenticated && <Navbar />}

      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <DefaultRedirect /> : <Login />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <DefaultRedirect /> : <Signup />}
        />
        <Route path="/" element={<DefaultRedirect />} />
        
        {/* Patient routes */}
        <Route
          path="/journal"
          element={<ProtectedRoute><Journal /></ProtectedRoute>}
        />
        <Route
          path="/insights"
          element={<ProtectedRoute><Insights /></ProtectedRoute>}
        />
        <Route
          path="/past-entries"
          element={<ProtectedRoute><PastEntries /></ProtectedRoute>}
        />
        <Route
          path="/settings"
          element={<ProtectedRoute><TherapistSharing /></ProtectedRoute>}
        />
        
        {/* Therapist routes */}
        <Route
          path="/therapist/dashboard"
          element={<ProtectedRoute><TherapistDashboard /></ProtectedRoute>}
        />
        <Route
          path="/therapist/patient/:patientId"
          element={<ProtectedRoute><PatientView /></ProtectedRoute>}
        />
        
        <Route path="*" element={<DefaultRedirect />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}