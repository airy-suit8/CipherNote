const express = require('express');
const { body, validationResult, query } = require('express-validator');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Note = require('../models/Note');

const router = express.Router();

// Create note
// POST /api/notes
router.post('/',
  auth,
  [
    body('title').isLength({ min: 1 }).trim(),
    body('content').optional().trim(),
    body('tags').optional().isArray()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, content, tags, pinned } = req.body;
    try {
      const note = new Note({
        owner: req.user.id,
        title,
        content,
        tags: tags || [],
        pinned: !!pinned
      });
      await note.save();
      res.status(201).json(note);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  });

// List notes with search/filter/pagination
// GET /api/notes?q=search&tags=tag1,tag2&from=2025-01-01&to=2025-02-01&sort=createdAt:desc&page=1&limit=10
router.get('/',
  auth,
  async (req, res) => {
    try {
      const {
        q, tags, from, to, sort = 'updatedAt:desc', page = 1, limit = 20, pinned
      } = req.query;

      const filter = { owner: req.user.id };

      if (q) {
        filter.$text = { $search: q };
      }

      if (tags) {
        const tagsArr = String(tags).split(',').map(t => t.trim()).filter(Boolean);
        if (tagsArr.length) filter.tags = { $all: tagsArr }; // all tags
      }

      if (pinned !== undefined) {
        if (pinned === 'true') filter.pinned = true;
        else if (pinned === 'false') filter.pinned = false;
      }

      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }

      // sort parser: e.g. createdAt:desc
      const [sortField, sortDir] = (sort || 'updatedAt:desc').split(':');
      const sortObj = { [sortField]: sortDir === 'asc' ? 1 : -1 };

      const pg = Math.max(1, parseInt(page, 10) || 1);
      const lim = Math.min(100, parseInt(limit, 10) || 20);
      const skip = (pg - 1) * lim;

      const [items, total] = await Promise.all([
        Note.find(filter).sort(sortObj).skip(skip).limit(lim),
        Note.countDocuments(filter)
      ]);

      res.json({
        total,
        page: pg,
        pageSize: items.length,
        items
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  });

// Get single note
// GET /api/notes/:id
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// Update note
// PUT /api/notes/:id
router.put('/:id',
  auth,
  [
    body('title').optional().isLength({ min: 1 }).trim(),
    body('content').optional().trim(),
    body('tags').optional().isArray(),
  ],
  async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const note = await Note.findById(id);
      if (!note) return res.status(404).json({ message: 'Note not found' });
      if (note.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

      const allowed = ['title', 'content', 'tags', 'pinned'];
      allowed.forEach(field => {
        if (req.body[field] !== undefined) note[field] = req.body[field];
      });

      await note.save();
      res.json(note);
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  });

// Delete note
// DELETE /api/notes/:id
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const note = await Note.findById(id);
    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.owner.toString() !== req.user.id) return res.status(403).json({ message: 'Forbidden' });
    await note.deleteOne();
    res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
