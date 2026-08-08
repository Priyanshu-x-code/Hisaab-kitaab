require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const workerRoutes = require('./routes/workers');
const hotelRoutes = require('./routes/hotels');
const partyRoutes = require('./routes/parties');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/parties', partyRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).json({ error: 'Route nahi mili' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server mein kuch gadbad ho gayi' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Roz Ka Hisaab backend chal raha hai: http://localhost:${PORT}`));
