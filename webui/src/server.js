// src/server.js
import express from 'express';
import todosRouter from './routes/path.js';
import './db.js';

const app = express();

app.use(express.json()); // parse JSON bodies

// Basic health route
app.get('/', (req, res) => {
    res.json({ ok: true, message: 'Express + SQLite up!' });
});

// Mount our router
app.use('/todos', todosRouter);

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
