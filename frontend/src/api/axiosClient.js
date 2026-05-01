import axios from "axios";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

// Attach auth token to every request
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Returns the backend base URL (origin only, no path).
 *
 * Priority:
 *  1. VITE_API_BACKEND env var  (e.g. https://pettycash.astutehealthcare.co.uk)
 *  2. Current page origin       (works for any deployment automatically)
 */
function getBackendOrigin() {
  const configured = import.meta.env.VITE_API_BACKEND;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return window.location.origin;
}

/**
 * Get the full URL for a file stored in /uploads.
 *
 * Uses /api/file/:filename — an explicit backend route that streams the file
 * directly and returns a proper 404 (not the SPA index.html) when missing.
 * This works correctly regardless of nginx proxy configuration.
 *
 * @param {string} filePath - e.g. "/uploads/1234-file.jpg" or just "1234-file.jpg"
 * @returns {string} Absolute URL accessible from the current browser context
 */
export const getFileUrl = (filePath) => {
  if (!filePath) return '';

  const backendOrigin = getBackendOrigin();

  // Extract just the filename from whatever format is passed in
  let filename = filePath;

  // Strip any hardcoded origin prefix (LAN IPs, old external IPs, etc.)
  filename = filename.replace(/^https?:\/\/[^/]+/, '');

  // Strip leading /uploads/ or uploads/ prefix — we'll use /api/file/ instead
  filename = filename.replace(/^\/?uploads\//, '');

  // Strip any remaining leading slash
  filename = filename.replace(/^\//, '');

  if (!filename) return '';

  return `${backendOrigin}/api/file/${filename}`;
};

export default axiosClient;