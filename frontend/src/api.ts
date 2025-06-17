import axios from 'axios';

const baseURL = process.env.REACT_APP_BACKEND_API || '/';
console.log('[API] Using backend baseURL:', baseURL);

const api = axios.create({
  baseURL,
});

export default api;
