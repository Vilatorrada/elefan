export const API_BASE = import.meta.env.VITE_API_URL || '/api';

const SESSION_KEY = 'sjv_eleccions_session';

let currentToken = null;
let lastEtag = null;
let unauthorizedHandler = null;

export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn;
}

export function loadStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.token && parsed?.user && parsed?.role) {
      currentToken = parsed.token;
      return parsed;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
}

export function saveStoredSession(session) {
  currentToken = session?.token || null;
  lastEtag = null; // Reset ETag when auth scope changes
  if (session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}

export function clearStoredSession() {
  currentToken = null;
  lastEtag = null;
  sessionStorage.removeItem(SESSION_KEY);
}

export async function apiFetch(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (currentToken) {
    headers.Authorization = `Bearer ${currentToken}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401 && currentToken && endpoint !== '/auth/login') {
    clearStoredSession();
    if (unauthorizedHandler) unauthorizedHandler();
  }

  return res;
}

export async function fetchDbState({ force = false } = {}) {
  const headers = {};
  if (!force && lastEtag) {
    headers['If-None-Match'] = lastEtag;
  }

  const res = await apiFetch('/data', { headers });
  if (res.status === 304) {
    return { notModified: true, data: null };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const etag = res.headers.get('ETag');
  if (etag) {
    lastEtag = etag;
  }

  const data = await res.json();
  return { notModified: false, data };
}

export async function downloadReportFile(endpoint, filename) {
  const res = await apiFetch(endpoint);
  if (!res.ok) {
    throw new Error(`Error descarregant l'informe (${res.status})`);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

