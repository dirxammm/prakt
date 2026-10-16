const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// GET /api/users/me — данные текущего пользователя и добавленные им материалы
router.get('/me', authRequired, async (req, res) => {
  const [users] = await pool.query('SELECT id, login, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!users.length) {
    return res.status(401).json({ error: 'Пользователь не найден' });
  }
  const [materials] = await pool.query(
    `SELECT m.id, m.title, m.description, m.type, m.file_path, m.created_at, c.name AS category
       FROM materials m JOIN categories c ON c.id = m.category_id
      WHERE m.author_id = ? ORDER BY m.created_at DESC, m.id DESC`,
    [req.user.id]
  );
  res.json({ user: users[0], materials });
});

module.exports = router;
