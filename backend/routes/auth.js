const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// GET /api/auth/malik-exists — landing page checks whether Malik setup is done
router.get('/malik-exists', (req, res) => {
  const row = db.prepare(`SELECT id FROM users WHERE role = 'malik' LIMIT 1`).get();
  res.json({ exists: !!row });
});

// POST /api/auth/register-malik — one-time setup, first user becomes Malik
router.post('/register-malik', (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ error: 'Name, phone aur password zaroori hai' });
  }
  const existing = db.prepare(`SELECT id FROM users WHERE role = 'malik'`).get();
  if (existing) {
    return res.status(409).json({ error: 'Malik account already set up. Please login.' });
  }
  const phoneTaken = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (phoneTaken) return res.status(409).json({ error: 'Yeh phone number pehle se registered hai' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(`INSERT INTO users (name, phone, role, password_hash) VALUES (?, ?, 'malik', ?)`)
    .run(name, phone, hash);

  const user = { id: info.lastInsertRowid, role: 'malik', name };
  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login-malik
router.post('/login-malik', (req, res) => {
  const { phone, password } = req.body;
  const user = db.prepare(`SELECT * FROM users WHERE phone = ? AND role = 'malik'`).get(phone);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash || '')) {
    return res.status(401).json({ error: 'Galat phone number ya password' });
  }
  res.json({ token: signToken(user), user: { id: user.id, role: user.role, name: user.name } });
});

// POST /api/auth/register-worker — self-registration, no password (matches notebook spec)
router.post('/register-worker', (req, res) => {
  const { name, phone, address } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name aur phone zaroori hai' });

  const phoneTaken = db.prepare(`SELECT id FROM users WHERE phone = ?`).get(phone);
  if (phoneTaken) return res.status(409).json({ error: 'Yeh phone number pehle se registered hai' });

  const info = db
    .prepare(`INSERT INTO users (name, phone, address, role) VALUES (?, ?, ?, 'worker')`)
    .run(name, phone, address || '');

  const user = { id: info.lastInsertRowid, role: 'worker', name };
  res.status(201).json({ token: signToken(user), user });
});

// POST /api/auth/login-worker — login by phone number only
router.post('/login-worker', (req, res) => {
  const { phone } = req.body;
  const user = db.prepare(`SELECT * FROM users WHERE phone = ? AND role = 'worker'`).get(phone);
  if (!user) return res.status(404).json({ error: 'Yeh phone number registered nahi hai' });
  res.json({ token: signToken(user), user: { id: user.id, role: user.role, name: user.name } });
});

module.exports = router;
