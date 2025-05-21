import axios from 'axios';

const api = axios.create({
  baseURL: '/', // Vite proxy will handle /images and /objects
});

export default api;
