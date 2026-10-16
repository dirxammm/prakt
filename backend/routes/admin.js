const express = require('express');
const pool = require('../config/db');
const { authRequired, adminRequired } = require('../middleware/auth');
const { removeUploadedFile } = require('../utils/files');

const router = express.Router();
router.use(authRequired, adminRequired);

// GET /api/admin/users — список пользователей
router.get('/users', async (req, res) => {
  const [rows] = await pool.query('SELECT id, login, email, role, created_at FROM users ORDER BY id');
  res.json(rows);
});

// GET /api/admin/materials — все материалы
router.get('/materials', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT m.id, m.title, m.type, m.file_path, m.created_at, c.name AS category, u.login AS author
       FROM materials m
       JOIN categories c ON c.id = m.category_id
       JOIN users u ON u.id = m.author_id
      ORDER BY m.created_at DESC, m.id DESC`
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
