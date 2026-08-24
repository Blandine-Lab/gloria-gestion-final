import axios from 'axios';

const API_URL = 'https://gloria-gestion-final-backend.vercel.app/api';

console.log('🔍 API_URL =', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;