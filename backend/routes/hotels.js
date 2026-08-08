const express = require('express');
const db = require('../db');
const { verifyToken, requireMalik } = require('../middleware/auth');

const router = express.Router();

// GET /api/hotels?q=search — All Hotel Info (any logged-in role can view/check)
router.get('/', verifyToken, (req, res) => {
  const q = (req.query.q || '').trim();
  const rows = q
    ? db.prepare(`SELECT * FROM hotels WHERE name LIKE ? ORDER BY name`).all(`%${q}%`)
    : db.prepare(`SELECT * FROM hotels ORDER BY name`).all();
  res.json(rows);
});

// POST /api/hotels — Add New Hotel (Malik only)
router.post('/', verifyToken, requireMalik, (req, res) => {
  const { name, hotel_amount } = req.body;
  if (!name) return res.status(400).json({ error: 'Hotel name zaroori hai' });
  const info = db
    .prepare(`INSERT INTO hotels (name, hotel_amount) VALUES (?, ?)`)
    .run(name, hotel_amount || 0);
  res.status(201).json(db.prepare(`SELECT * FROM hotels WHERE id = ?`).get(info.lastInsertRowid));
});

// PATCH /api/hotels/:id — Malik changes hotel_amount
router.patch('/:id', verifyToken, requireMalik, (req, res) => {
  const hotel = db.prepare(`SELECT * FROM hotels WHERE id = ?`).get(req.params.id);
  if (!hotel) return res.status(404).json({ error: 'Hotel nahi mila' });
  const { hotel_amount, name } = req.body;
  db.prepare(`UPDATE hotels SET hotel_amount = COALESCE(?, hotel_amount), name = COALESCE(?, name) WHERE id = ?`)
    .run(hotel_amount ?? null, name ?? null, req.params.id);
  res.json(db.prepare(`SELECT * FROM hotels WHERE id = ?`).get(req.params.id));
});

// GET /api/hotels/:id — hotel detail + date-wise party list with computed totals
router.get('/:id', verifyToken, (req, res) => {
  const hotel = db.prepare(`SELECT * FROM hotels WHERE id = ?`).get(req.params.id);
  if (!hotel) return res.status(404).json({ error: 'Hotel nahi mila' });

  const parties = db
    .prepare(
      `SELECT p.id, p.date, p.category,
              (SELECT COUNT(*) FROM party_workers pw WHERE pw.party_id = p.id) AS worker_count
       FROM parties p WHERE p.hotel_id = ? ORDER BY p.date DESC`
    )
    .all(req.params.id)
    .map((p) => ({ ...p, amount: p.worker_count * hotel.hotel_amount }));

  const total_amount = parties.reduce((sum, p) => sum + p.amount, 0);

  res.json({ ...hotel, parties, total_amount });
});

// GET /api/hotels/:id/parties/:partyId — one party's worker list (the "date click" screen)
router.get('/:id/parties/:partyId', verifyToken, (req, res) => {
  const hotel = db.prepare(`SELECT * FROM hotels WHERE id = ?`).get(req.params.id);
  const party = db
    .prepare(`SELECT * FROM parties WHERE id = ? AND hotel_id = ?`)
    .get(req.params.partyId, req.params.id);
  if (!hotel || !party) return res.status(404).json({ error: 'Nahi mila' });

  const workers = db
    .prepare(
      `SELECT u.id, u.name FROM party_workers pw
       JOIN users u ON u.id = pw.user_id
       WHERE pw.party_id = ? ORDER BY u.name`
    )
    .all(party.id);

  res.json({
    hotel: { id: hotel.id, name: hotel.name, hotel_amount: hotel.hotel_amount },
    party,
    workers,
    total_amount: workers.length * hotel.hotel_amount,
  });
});

module.exports = router;
