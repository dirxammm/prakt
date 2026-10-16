const express = require('express');
const pool = require('../config/db');

const router = express.Router();

// GET /api/categories — список категорий
router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT id, name FROM categories ORDER BY id');
  res.json(rows);
});

module.exports = router;
