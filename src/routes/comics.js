'use strict';

const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/comics?search=&status=&publisher=&series=
router.get('/', (req, res) => {
  try {
    const { search, status, publisher, series } = req.query;
    const comics = db.listComics({ search, status, publisher, series });
    res.json(comics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comics/stats
router.get('/stats', (req, res) => {
  try {
    res.json(db.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/comics/:id
router.get('/:id', (req, res) => {
  try {
    const comic = db.getComic(Number(req.params.id));
    if (!comic) return res.status(404).json({ error: 'Not found' });
    res.json(comic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/comics
router.post('/', (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    const comic = db.createComic(req.body);
    res.status(201).json(comic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/comics/:id
router.patch('/:id', (req, res) => {
  try {
    const comic = db.updateComic(Number(req.params.id), req.body);
    if (!comic) return res.status(404).json({ error: 'Not found' });
    res.json(comic);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/comics/:id
router.delete('/:id', (req, res) => {
  try {
    const deleted = db.deleteComic(Number(req.params.id));
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
