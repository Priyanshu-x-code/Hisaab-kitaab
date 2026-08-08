// api.js — shared fetch helper + session storage, loaded on every page

const API_BASE = 'http://localhost:4000/api';

const Session = {
  save(token, user) {
    localStorage.setItem('rkh_token', token);
    localStorage.setItem('rkh_user', JSON.stringify(user));
  },
  token() { return localStorage.getItem('rkh_token'); },
  user() {
    const raw = localStorage.getItem('rkh_user');
    return raw ? JSON.parse(raw) : null;
  },
  clear() {
    localStorage.removeItem('rkh_token');
    localStorage.removeItem('rkh_user');
  },
  requireRole(role) {
    const user = Session.user();
    if (!user || user.role !== role || !Session.token()) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  },
};

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Session.token();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }

  if (!res.ok) {
    const message = data?.error || 'Kuch gadbad ho gayi';
    if (res.status === 401) Session.clear();
    throw new Error(message);
  }
  return data;
}

function showError(el, message) {
  el.textContent = message;
  el.classList.add('show');
}
function hideError(el) {
  el.textContent = '';
  el.classList.remove('show');
}
function money(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}
function todayStamp() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}
