const DEFAULT_API_BASE_URL = 'http://127.0.0.1:5050';

const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const rawApiBaseUrl = envApiBaseUrl === 'same-origin' ? '' : envApiBaseUrl || DEFAULT_API_BASE_URL;

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, '');
