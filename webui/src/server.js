// src/server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cardsRouter from './routes/cards.js';
import './db.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'views')));

// Basic health route
app.get('/', (req, res) => {
    res.json({ ok: true, message: 'Express + SQLite up!' });
});

app.use('/cards', cardsRouter);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
});
