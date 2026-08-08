const express = require('express');
const db = require('../db');
const { verifyToken, requireMalik } = require('../middleware/auth');

const router = express.Router();

function withAmount(w) {
  return { ...w, amount: Math.round(w.days_worked * w.per_day_rate * 100) / 100 };
}

// GET /api/workers — Malik's worker list (Worker Info table)
router.get('/', verifyToken, requireMalik, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, name, phone, address, per_day_rate, advance_amount, days_worked
       FROM users WHERE role = 'worker' ORDER BY name`
    )
    .all();
  res.json(rows.map(withAmount));
});

// GET /api/workers/me — logged-in worker's own dashboard
router.get('/me', verifyToken, (req, res) => {
  if (req.user.role !== 'worker') return res.status(403).json({ error: 'Workers only' });
  const w = db
    .prepare(
      `SELECT id, name, phone, address, per_day_rate, advance_amount, days_worked
       FROM users WHERE id = ?`
    )
    .get(req.user.id);
  if (!w) return res.status(404).json({ error: 'Not found' });
  res.json(withAmount(w));
});

// PATCH /api/workers/:id — Malik edits rate / advance / contact
router.patch('/:id', verifyToken, requireMalik, (req, res) => {
  const { per_day_rate, advance_amount, phone, address } = req.body;
  const worker = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'worker'`).get(req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker nahi mila' });

  db.prepare(
    `UPDATE users SET
       per_day_rate = COALESCE(?, per_day_rate),
       advance_amount = COALESCE(?, advance_amount),
       phone = COALESCE(?, phone),
       address = COALESCE(?, address)
     WHERE id = ?`
  ).run(per_day_rate ?? null, advance_amount ?? null, phone ?? null, address ?? null, req.params.id);

  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
  res.json(withAmount(updated));
});

// POST /api/workers/:id/clear — reset days worked & amount to zero (after payout)
router.post('/:id/clear', verifyToken, requireMalik, (req, res) => {
  const worker = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'worker'`).get(req.params.id);
  if (!worker) return res.status(404).json({ error: 'Worker nahi mila' });

  db.prepare(`UPDATE users SET days_worked = 0, advance_amount = 0 WHERE id = ?`).run(req.params.id);
  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id);
  res.json(withAmount(updated));
});

module.exports = router;
