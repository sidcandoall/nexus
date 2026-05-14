import axios from "axios";
import { ApiError, normalizeApiError } from "./apiErrors";
import { showApiError } from "./notifications";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  timeout: 10000,
});

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

function getAuthContext() {
  // Local header-based auth context used by backend middleware.
  const userId = localStorage.getItem("mindmirror:userId") || "patient-demo-1";
  const role = localStorage.getItem("mindmirror:role") || "patient";
  return { userId, role };
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  const { userId, role } = getAuthContext();
  config.headers["x-user-id"] = userId;
  config.headers["x-user-role"] = role;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalizedError = normalizeApiError(error);
    if (!error.config?.skipGlobalErrorToast) {
      showApiError(normalizedError.message);
    }
    return Promise.reject(normalizedError);
  }
);

export const authAPI = {
  login: (data) => api.post("/login", data),
  register: (data) => api.post("/register", data),
};

export const checkinAPI = {
  create: (data) => api.post("/checkin", data),
  getAll: () => api.get("/checkins"),
  list: () => api.get("/checkins"),
  summary: () => api.get("/sentiment-summary"),
  history: () => api.get("/mood/history"),
  toggleSharing: (entryId, shared) =>
    api.patch(`/checkins/${entryId}/sharing`, { shared_with_therapist: shared }),
};

export const sharingAPI = {
  getStatus:  ()         => api.get("/sharing/status"),
  setEnabled: (enabled)  => api.patch("/sharing/enabled", { sharing_enabled: enabled }),
  link:       (id)       => api.post("/sharing/link", { therapist_id: id }),
  unlink:     (id)       => api.delete(`/sharing/link/${id}`),
};

export const dashboardAPI = {
  get: () => api.get("/insight"),
};

export const therapistAPI = {
  patients: () => api.get("/therapist/patients"),
  patientProfile: (patientId) => api.get(`/therapist/patients/${patientId}/profile`),
  patientJournal: (patientId) => api.get(`/therapist/patients/${patientId}/journal`),
  patientMood: (patientId) => api.get(`/therapist/patients/${patientId}/mood`),
  patientEntries: (patientId) => api.get(`/therapist/patients/${patientId}/journal-entries`),
  patientMoodTrend: (patientId) => api.get(`/therapist/patients/${patientId}/mood-trend`),
};

export default api;
export { ApiError, normalizeApiError };
