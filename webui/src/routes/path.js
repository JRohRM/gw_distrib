// src/routes/todos.js
import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /todos  -> list
router.get('/', (req, res) => {
    const todos = db.prepare('SELECT * FROM todos ORDER BY id DESC').all();
    res.json(todos);
});

// GET /todos/:id -> single
router.get('/:id', (req, res) => {
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    if (!todo) return res.status(404).json({ error: 'Not found' });
    res.json(todo);
});

// POST /todos -> create { title }
router.post('/', (req, res) => {
    const { title } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title is required' });
    const info = db.prepare('INSERT INTO todos (title) VALUES (?)').run(title);
    const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(todo);
});

// PATCH /todos/:id -> update { title?, done? }
router.patch('/:id', (req, res) => {
    const { title, done } = req.body || {};
    const existing = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const nextTitle = title ?? existing.title;
    const nextDone = typeof done === 'number' ? done : existing.done;

    db.prepare('UPDATE todos SET title = ?, done = ? WHERE id = ?')
        .run(nextTitle, nextDone, req.params.id);

    const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
    res.json(updated);
});

// DELETE /todos/:id
router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
    if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
});

export default router;
