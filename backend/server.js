const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const app = express();
const FRONTEND = path.join(__dirname, '..', 'frontend');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Загруженные файлы и клиентская часть
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(FRONTEND));

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
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'Файл слишком большой' });
  if (err.code === 'INVALID_FILE_TYPE') return res.status(400).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const PORT = process.env.PORT || 3000;
pool
  .query('SELECT 1')
  .then(() => {
    console.log('MySQL: подключение установлено');
    app.listen(PORT, () => console.log(`Сервер запущен: http://localhost:${PORT}`));
  })
  .catch((e) => {
    console.error('Ошибка подключения к MySQL:', e.message);
    process.exit(1);
  });
