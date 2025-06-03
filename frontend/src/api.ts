import axios from 'axios';

const api = axios.create({
  baseURL: '/', // Will be proxied to backend in dev
});

export default api;
