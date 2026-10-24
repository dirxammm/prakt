const express = require('express');
const pool = require('../config/db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { removeUploadedFile } = require('../utils/files');
const { parseFilters } = require('../utils/filters');

const router = express.Router();
router.use(authRequired, adminRequired);

// GET /api/admin/users — список пользователей с количеством их материалов
router.get('/users', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.login, u.email, u.role, u.created_at, COUNT(m.id) AS materials_count
       FROM users u LEFT JOIN materials m ON m.author_id = u.id
      GROUP BY u.id, u.login, u.email, u.role, u.created_at
      ORDER BY u.id`
  );
  res.json(rows);
});

// GET /api/admin/materials — все материалы (необязательные параметры type, q)
router.get('/materials', async (req, res) => {
  const f = parseFilters(req.query);
  if (f.error) {
    return res.status(400).json({ error: f.error });
  }
  const [rows] = await pool.query(
    `SELECT m.id, m.title, m.type, m.file_path, m.created_at, c.name AS category, u.login AS author
       FROM materials m
       JOIN categories c ON c.id = m.category_id
       JOIN users u ON u.id = m.author_id
       ${f.clause}
      ORDER BY m.created_at DESC, m.id DESC`,
    f.params
  );
  res.json(rows);
});

// DELETE /api/admin/materials/:id — удаление любого материала
router.delete('/materials/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Материал не найден' });
  }
  const [rows] = await pool.query('SELECT id, file_path FROM materials WHERE id = ?', [req.params.id]);
  if (!rows.length) {
    return res.status(404).json({ error: 'Материал не найден' });
  }
  await pool.query('DELETE FROM materials WHERE id = ?', [rows[0].id]);
  removeUploadedFile(rows[0].file_path);
  res.json({ message: 'Материал удалён' });
});

module.exports = router;
