const express = require('express');
const db = require('../db');
const { verifyToken, requireMalik } = require('../middleware/auth');

const router = express.Router();

// POST /api/parties — Add New Party: picks a hotel, category, date, and N workers.
// Each selected worker automatically gets +1 day credited.
router.post('/', verifyToken, requireMalik, (req, res) => {
  const { hotel_id, category, date, worker_ids } = req.body;

  if (!hotel_id || !category || !date || !Array.isArray(worker_ids) || worker_ids.length === 0) {
    return res.status(400).json({ error: 'Hotel, category, date aur kam se kam ek worker zaroori hai' });
  }
  if (!['lunch', 'dinner', 'breakfast'].includes(category)) {
    return res.status(400).json({ error: 'Category lunch, dinner ya breakfast honi chahiye' });
  }
  const hotel = db.prepare(`SELECT id FROM hotels WHERE id = ?`).get(hotel_id);
  if (!hotel) return res.status(404).json({ error: 'Hotel nahi mila' });

  const uniqueWorkerIds = [...new Set(worker_ids)];

  const createParty = db.transaction(() => {
    const info = db
      .prepare(`INSERT INTO parties (hotel_id, category, date) VALUES (?, ?, ?)`)
      .run(hotel_id, category, date);
    const partyId = info.lastInsertRowid;

    const insertPW = db.prepare(
      `INSERT INTO party_workers (party_id, user_id, day_credit) VALUES (?, ?, 1)`
    );
    const bumpDays = db.prepare(
      `UPDATE users SET days_worked = days_worked + 1 WHERE id = ? AND role = 'worker'`
    );

    for (const uid of uniqueWorkerIds) {
      const worker = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'worker'`).get(uid);
      if (!worker) throw new Error(`Worker ${uid} nahi mila`);
      insertPW.run(partyId, uid);
      bumpDays.run(uid);
    }
    return partyId;
  });

  try {
    const partyId = createParty();
    const party = db.prepare(`SELECT * FROM parties WHERE id = ?`).get(partyId);
    res.status(201).json(party);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/parties/:partyId/workers/:oldUserId — Change: swap a worker on this party.
// Old worker's already-earned day stays as is; new worker gets +1 day.
router.patch('/:partyId/workers/:oldUserId', verifyToken, requireMalik, (req, res) => {
  const { new_user_id } = req.body;
  const { partyId, oldUserId } = req.params;

  if (!new_user_id) return res.status(400).json({ error: 'Naya worker chuno' });

  const pw = db
    .prepare(`SELECT * FROM party_workers WHERE party_id = ? AND user_id = ?`)
    .get(partyId, oldUserId);
  if (!pw) return res.status(404).json({ error: 'Yeh worker is party mein nahi hai' });

  const alreadyIn = db
    .prepare(`SELECT id FROM party_workers WHERE party_id = ? AND user_id = ?`)
    .get(partyId, new_user_id);
  if (alreadyIn) {
    return res.status(409).json({ error: 'Yeh worker pehle se is list mein hai' });
  }
  const newWorker = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'worker'`).get(new_user_id);
  if (!newWorker) return res.status(404).json({ error: 'Naya worker nahi mila' });

  const swap = db.transaction(() => {
    db.prepare(`UPDATE party_workers SET user_id = ? WHERE id = ?`).run(new_user_id, pw.id);
    db.prepare(`UPDATE users SET days_worked = days_worked + 1 WHERE id = ?`).run(new_user_id);
  });
  swap();

  res.json({ ok: true });
});

// DELETE /api/hotel-parties/:partyId — Clear option: removes a party entry and
// rolls back the day credit it gave to each worker.
router.delete('/:partyId', verifyToken, requireMalik, (req, res) => {
  const party = db.prepare(`SELECT * FROM parties WHERE id = ?`).get(req.params.partyId);
  if (!party) return res.status(404).json({ error: 'Nahi mila' });

  const clearParty = db.transaction(() => {
    const workers = db
      .prepare(`SELECT user_id FROM party_workers WHERE party_id = ?`)
      .all(party.id);
    const decrement = db.prepare(
      `UPDATE users SET days_worked = MAX(0, days_worked - 1) WHERE id = ?`
    );
    for (const w of workers) decrement.run(w.user_id);
    db.prepare(`DELETE FROM parties WHERE id = ?`).run(party.id);
  });
  clearParty();

  res.json({ ok: true });
});

module.exports = router;
