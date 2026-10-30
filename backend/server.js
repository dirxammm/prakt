const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.JWT_SECRET) {
  console.error('Ошибка: не задан JWT_SECRET в файле backend/.env');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const { cleanTmp } = require('./utils/files');

const app = express();
const FRONTEND = path.join(__dirname, '..', 'frontend');

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Загруженные файлы (поддерживается частичная отдача Range для перемотки аудио и видео) и клиентская часть
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(FRONTEND));

// Проверка работоспособности сервера и базы данных
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(503).json({ status: 'error', error: 'База данных недоступна' });
  }
});

// Маршруты API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Маршрут не найден' }));

// Несуществующие страницы
app.use((req, res) => {
  res.status(404).sendFile(path.join(FRONTEND, '404.html'), (err) => {
    if (err) res.status(404).send('Страница не найдена');
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  if (req.file) fs.unlink(req.file.path, () => {});
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой. Максимальный размер: 100 МБ' });
  if (err.code === 'INVALID_FILE_TYPE') return res.status(400).json({ error: err.message });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Некорректная отправка файла: передавайте один файл в поле file' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Слишком большой запрос' });
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

async function start() {
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error('Ошибка подключения к MySQL:', e.message);
    process.exit(1);
  }
  console.log('MySQL: подключение установлено');
  const removed = cleanTmp();
  if (removed) console.log(`Удалено устаревших временных файлов: ${removed}`);

  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE'
      ? `Ошибка: порт ${PORT} уже занят (возможно, сервер уже запущен в другом окне)`
      : 'Ошибка запуска сервера: ' + e.message);
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) start();
module.exports = app;
