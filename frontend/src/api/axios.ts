import axios from 'axios';
import { clearAuthSession, getAccessToken, isDemoSocialToken } from '../app/lib/auth';
import { API_BASE_URL } from '../config/api';

// Create an axios instance with the backend base URL.
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the stored access token to every outgoing request when available.
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url || '');

    if (status === 401 && !requestUrl.includes('/api/auth/') && !isDemoSocialToken(getAccessToken())) {
      clearAuthSession();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
        window.location.assign('/auth/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
