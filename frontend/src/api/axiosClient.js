import axios from "axios";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://172.30.36.47:5005/api",
  withCredentials: true,
});

/**
 * Get the full URL for a file
 * @param {string} filePath - The file path from the database
 * @returns {string} Full URL to access the file
 */
// frontend/src/api/axiosClient.js
// Attach auth token to every request
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getFileUrl = (filePath) => {
  if (!filePath) return '';
  
  // If the path is already a full URL, return it as is
  if (filePath.startsWith('http')) {
    // If the current host is the external IP but the URL is local, convert it
    if (window.location.hostname === '103.206.209.210' && filePath.includes('172.30.36.47')) {
      return filePath.replace('http://172.30.36.47:5005', 'http://103.206.209.210:5005');
    }
    // If the current host is local but the URL is external, convert it
    if (window.location.hostname === '172.30.36.47' && filePath.includes('103.206.209.210')) {
      return filePath.replace('http://103.206.209.210:5005', 'http://172.30.36.47:5005');
    }
    return filePath;
  }
  
  // For relative paths, determine the correct base URL
  const baseUrl = window.location.hostname === '103.206.209.210' 
    ? 'http://103.206.209.210:5005' 
    : 'http://172.30.36.47:5005';
  
  return `${baseUrl}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
};

export default axiosClient;