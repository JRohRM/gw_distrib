import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /cards → JSON list of cards
router.get('/', (req, res) => {
    const cards = db.prepare('SELECT * FROM cards ORDER BY created_at DESC').all();
    res.json(cards);
});

export default router;
