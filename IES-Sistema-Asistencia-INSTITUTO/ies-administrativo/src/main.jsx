import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Adjunta la sesión a todas las consultas administrativas para proteger también las lecturas.
const fetchOriginal = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const api = url.includes(':8000/') || url.startsWith('/');
  const token = sessionStorage.getItem('ies_admin_session');
  if (!api || !token) return fetchOriginal(input, init);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('X-Admin-Session', token);
  return fetchOriginal(input, { ...init, headers });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
