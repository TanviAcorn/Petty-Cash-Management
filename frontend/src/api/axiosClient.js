import axios from "axios";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://172.30.36.47:5005/api",
  withCredentials: true,
});

export default axiosClient;