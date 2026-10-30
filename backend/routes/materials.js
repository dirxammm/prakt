const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { upload, RULES, detectType, moveToFolder, discard } = require('../middleware/upload');
const { removeUploadedFile } = require('../utils/files');
const { parseFilters } = require('../utils/filters');

const router = express.Router();

const TYPES = ['image', 'video', 'audio'];
const SELECT_MATERIAL = `
  SELECT m.id, m.title, m.description, m.type, m.file_path, m.created_at,
         m.category_id, c.name AS category, m.author_id, u.login AS author
    FROM materials m
    JOIN categories c ON c.id = m.category_id
    JOIN users u ON u.id = m.author_id`;

// GET /api/materials — список материалов
// Параметры (необязательные): type=image|video|audio, category=<номер категории>, q=<часть названия>
router.get('/', async (req, res) => {
  const f = parseFilters(req.query);
  if (f.error) {
    return res.status(400).json({ error: f.error });
  }
  const [rows] = await pool.query(`${SELECT_MATERIAL} ${f.clause} ORDER BY m.created_at DESC, m.id DESC`, f.params);
  res.json(rows);
});

// GET /api/materials/:id — один материал
router.get('/:id', async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Материал не найден' });
  }
  const [rows] = await pool.query(`${SELECT_MATERIAL} WHERE m.id = ?`, [req.params.id]);
  if (!rows.length) {
    return res.status(404).json({ error: 'Материал не найден' });
  }
  res.json(rows[0]);
});

// POST /api/materials — добавление материала (multipart/form-data, только для авторизованных)
// Поля: title, description, category_id, type, file (для видео вместо файла можно передать link)
router.post('/', authRequired, upload.single('file'), async (req, res) => {
  const body = req.body || {};
  const title = body.title === undefined ? '' : String(body.title).trim();
  const description = body.description === undefined ? '' : String(body.description).trim();
  const { category_id, type } = body;
  const link = body.link === undefined ? '' : String(body.link).trim();
  const file = req.file;
  let savedPath = null; // путь файла после переноса в папку своего типа

  const fail = (msg) => {
    discard(file);
    return res.status(400).json({ error: msg });
  };

  try {
    if (!title) return fail('Укажите название материала');
    if (title.length > 150) return fail('Название не должно быть длиннее 150 символов');
    if (description.length > 2000) return fail('Описание не должно быть длиннее 2000 символов');
    if (!TYPES.includes(type)) return fail('Выберите тип материала: изображение, видео или аудио');
    if (!/^\d+$/.test(String(category_id || ''))) return fail('Выберите категорию');

    const [cats] = await pool.query('SELECT id FROM categories WHERE id = ?', [category_id]);
    if (!cats.length) return fail('Выбранная категория не существует');

    let filePath;
    if (file) {
      if (detectType(file) !== type) return fail('Формат файла не соответствует выбранному типу материала');
      if (file.size > RULES[type].max) {
        return fail(`Файл слишком большой. Максимальный размер: ${RULES[type].max / 1024 / 1024} МБ`);
      }
      savedPath = moveToFolder(file, type);
      filePath = savedPath;
    } else if (type === 'video' && link) {
      if (!/^https?:\/\/\S+$/i.test(link) || link.length > 500) return fail('Некорректная ссылка на видео');
      filePath = link;
    } else {
      return fail(type === 'video' ? 'Загрузите видеофайл или укажите ссылку на видео' : 'Загрузите файл');
    }

    const [result] = await pool.query(
      'INSERT INTO materials (title, description, type, category_id, file_path, author_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, description || null, type, category_id, filePath, req.user.id]
    );
    const [rows] = await pool.query(`${SELECT_MATERIAL} WHERE m.id = ?`, [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (e) {
    // при любой ошибке не оставляем файлы на диске: ни временный, ни уже перенесённый
    discard(file);
    removeUploadedFile(savedPath);
    if (e.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(401).json({ error: 'Пользователь не найден. Войдите заново' });
    }
    throw e;
  }
});

// DELETE /api/materials/:id — удаление материала (автор или администратор)
router.delete('/:id', authRequired, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({ error: 'Материал не найден' });
  }
  const [rows] = await pool.query('SELECT id, author_id, file_path FROM materials WHERE id = ?', [req.params.id]);
  if (!rows.length) {
    return res.status(404).json({ error: 'Материал не найден' });
  }
  const m = rows[0];
  if (m.author_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Можно удалять только свои материалы' });
  }
  await pool.query('DELETE FROM materials WHERE id = ?', [m.id]);
  removeUploadedFile(m.file_path);
  res.json({ message: 'Материал удалён' });
});

module.exports = router;
