// Демо-данные для показа проекта: npm run seed-demo
// Создаёт двух пользователей и материалы с настоящими файлами (картинки и звук генерируются сами).
// Удалить демо-данные: npm run seed-demo -- --reset
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { UPLOADS } = require('../utils/files');
const { scenePng, makeWav } = require('../utils/media');

const PASSWORD = 'Demo12345';
const USERS = [
  { login: 'demo_anna', email: 'anna@demo.local' },
  { login: 'demo_max', email: 'max@demo.local' },
];

const SCENES = {
  sunset: { top: [250, 160, 90], bottom: [120, 60, 120], sun: [0.5, 0.62, 0.12], sunColor: [255, 232, 150], ground: { level: 0.74, color: [30, 20, 50], peaks: 90 } },
  mountains: { top: [90, 150, 220], bottom: [220, 235, 250], sun: [0.8, 0.2, 0.07], sunColor: [255, 250, 220], ground: { level: 0.7, color: [70, 80, 100], peaks: 70 } },
  forest: { top: [150, 210, 190], bottom: [230, 245, 220], sun: [0.25, 0.25, 0.08], sunColor: [255, 245, 190], ground: { level: 0.66, color: [30, 90, 50], peaks: 40 } },
  sea: { top: [110, 180, 230], bottom: [230, 240, 250], sun: [0.65, 0.3, 0.09], sunColor: [255, 245, 200], ground: { level: 0.62, color: [20, 90, 150] }, wave: { len: 22, amp: 5 } },
  night: { top: [10, 15, 45], bottom: [60, 50, 110], sun: [0.3, 0.3, 0.07], sunColor: [240, 240, 255], ground: { level: 0.8, color: [15, 15, 30], peaks: 110 } },
  autumn: { top: [240, 190, 120], bottom: [250, 230, 190], sun: [0.55, 0.45, 0.1], sunColor: [255, 210, 110], ground: { level: 0.7, color: [150, 80, 30], peaks: 55 } },
};

// category: название категории из таблицы categories
const ITEMS = [
  { user: 0, hours: 70, type: 'image', category: 'Фотографии', title: 'Закат над горами', description: 'Тёплый вечерний свет над горным хребтом.', scene: 'sunset' },
  { user: 1, hours: 60, type: 'image', category: 'Фотографии', title: 'Горный пейзаж', description: 'Утро в горах, лёгкая дымка над вершинами.', scene: 'mountains' },
  { user: 0, hours: 52, type: 'image', category: 'Фотографии', title: 'Лесная тропа', description: 'Тропинка через светлый летний лес.', scene: 'forest' },
  { user: 1, hours: 44, type: 'image', category: 'Развлечения', title: 'Морской берег', description: 'Спокойное море в ясный день.', scene: 'sea' },
  { user: 0, hours: 30, type: 'image', category: 'Фотографии', title: 'Ночное небо', description: 'Лунная ночь над холмами.', scene: 'night' },
  { user: 1, hours: 20, type: 'image', category: 'Другое', title: 'Осенний день', description: 'Золотая осень на склонах.', scene: 'autumn' },
  { user: 0, hours: 40, type: 'audio', category: 'Музыка', title: 'Тон «Ля» 440 Гц', description: 'Камертонный тон для настройки инструментов.', freq: 440 },
  { user: 1, hours: 26, type: 'audio', category: 'Музыка', title: 'Тон «До» 262 Гц', description: 'Нота до первой октавы.', freq: 262 },
  { user: 0, hours: 14, type: 'audio', category: 'Обучение', title: 'Тон «Ми» 330 Гц', description: 'Пример звука для урока по акустике.', freq: 330 },
  { user: 1, hours: 10, type: 'video', category: 'Обучение', title: 'Видео: Big Buck Bunny (фрагмент)', description: 'Короткий мультфильм, прямая ссылка на видеофайл.', link: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  { user: 0, hours: 6, type: 'video', category: 'Развлечения', title: 'Видео: цветок', description: 'Ускоренная съёмка цветения (материал с открытой лицензией).', link: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
];

const unique = (ext) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;

async function reset() {
  const logins = USERS.map((u) => u.login);
  const [mats] = await pool.query(
    'SELECT m.file_path FROM materials m JOIN users u ON u.id = m.author_id WHERE u.login IN (?)', [logins]);
  mats.forEach((m) => {
    if (m.file_path.startsWith('/uploads/')) fs.unlink(path.join(UPLOADS, '..', m.file_path), () => {});
  });
  const [r] = await pool.query('DELETE FROM users WHERE login IN (?)', [logins]);
  console.log(`Демо-данные удалены (пользователей: ${r.affectedRows}, материалов: ${mats.length})`);
}

async function seed() {
  const [cats] = await pool.query('SELECT id, name FROM categories');
  const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]));
  if (!cats.length) throw new Error('Нет категорий. Сначала выполните npm run db:init');

  const hash = await bcrypt.hash(PASSWORD, 10);
  const ids = [];
  for (const u of USERS) {
    await pool.query('INSERT IGNORE INTO users (login, email, password_hash) VALUES (?, ?, ?)', [u.login, u.email, hash]);
    const [[row]] = await pool.query('SELECT id FROM users WHERE login = ?', [u.login]);
    ids.push(row.id);
  }

  let added = 0;
  for (const it of ITEMS) {
    const author = ids[it.user];
    const [dup] = await pool.query('SELECT id FROM materials WHERE title = ? AND author_id = ?', [it.title, author]);
    if (dup.length) continue;
    if (!catId[it.category]) throw new Error(`Нет категории «${it.category}»`);

    let filePath = it.link;
    if (it.type === 'image') {
      const name = unique('.png');
      fs.writeFileSync(path.join(UPLOADS, 'images', name), scenePng(SCENES[it.scene]));
      filePath = `/uploads/images/${name}`;
    } else if (it.type === 'audio') {
      const name = unique('.wav');
      fs.writeFileSync(path.join(UPLOADS, 'audio', name), makeWav({ freq: it.freq, seconds: 4 }));
      filePath = `/uploads/audio/${name}`;
    }
    await pool.query(
      'INSERT INTO materials (title, description, type, category_id, file_path, author_id, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? HOUR)',
      [it.title, it.description, it.type, catId[it.category], filePath, author, it.hours]
    );
    added++;
  }
  console.log(added ? `Добавлено материалов: ${added}` : 'Демо-материалы уже есть, ничего не добавлено');
  console.log(`Демо-пользователи: ${USERS.map((u) => u.login).join(', ')}  пароль: ${PASSWORD}`);
}

(async () => {
  for (const f of ['images', 'videos', 'audio']) fs.mkdirSync(path.join(UPLOADS, f), { recursive: true });
  process.argv.includes('--reset') ? await reset() : await seed();
  await pool.end();
})().catch((e) => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
