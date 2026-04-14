import axios from 'axios';
import { getToken, clearToken } from './auth';

const request = axios.create({ baseURL: '/api' });

request.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

request.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) clearToken();
    return Promise.reject(err);
  },
);

export default request;
