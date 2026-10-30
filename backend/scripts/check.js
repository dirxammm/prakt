// Проверка готовности проекта к запуску и сдаче: npm run check
// Параметр --fix удаляет «лишние» файлы из uploads (которых нет в базе данных) и старые временные файлы.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { UPLOADS } = require('../utils/files');

const FIX = process.argv.includes('--fix');
let fails = 0;
let warns = 0;
const ok = (m) => console.log(`  [ OK ] ${m}`);
const bad = (m) => { fails++; console.log(`  [FAIL] ${m}`); };
const warn = (m) => { warns++; console.log(`  [ !! ] ${m}`); };

const EXPECTED = {
  users: ['id', 'login', 'email', 'password_hash', 'role', 'created_at'],
  categories: ['id', 'name'],
  materials: ['id', 'title', 'description', 'type', 'category_id', 'file_path', 'author_id', 'created_at'],
};

(async () => {
  console.log('\nОкружение');
  const major = Number(process.versions.node.split('.')[0]);
  major >= 18 ? ok(`Node.js ${process.versions.node}`) : bad(`Node.js ${process.versions.node}: нужна версия 18 или новее`);
  const envFile = path.join(__dirname, '..', '.env');
  fs.existsSync(envFile) ? ok('файл backend/.env найден') : bad('нет файла backend/.env (скопируйте .env.example в .env)');
  const secret = process.env.JWT_SECRET || '';
  if (!secret) bad('JWT_SECRET не задан');
  else if (secret.length < 16 || /замените/i.test(secret)) warn('JWT_SECRET слишком простой: задайте длинную случайную строку (от 16 символов)');
  else ok('JWT_SECRET задан');
  if (!process.env.DB_USER) bad('DB_USER не задан в .env');

  console.log('\nБаза данных');
  let conn;
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'multimedia_gallery', charset: 'utf8mb4',
    });
    ok(`подключение к ${process.env.DB_NAME || 'multimedia_gallery'} установлено`);
  } catch (e) {
    bad(`нет подключения к MySQL: ${e.message} (запущена ли MySQL, верны ли данные в .env, выполнен ли npm run db:init)`);
  }

  if (conn) {
    const db = process.env.DB_NAME || 'multimedia_gallery';
    const [cs] = await conn.query('SELECT default_character_set_name AS cs FROM information_schema.schemata WHERE schema_name = ?', [db]);
    cs[0] && cs[0].cs === 'utf8mb4' ? ok('кодировка базы utf8mb4') : warn(`кодировка базы ${cs[0] ? cs[0].cs : '?'}: для русского текста нужна utf8mb4`);

    for (const [table, cols] of Object.entries(EXPECTED)) {
      const [rows] = await conn.query('SELECT column_name AS c FROM information_schema.columns WHERE table_schema = ? AND table_name = ?', [db, table]);
      const have = rows.map((r) => r.c);
      if (!have.length) { bad(`нет таблицы ${table} (выполните npm run db:init)`); continue; }
      const missing = cols.filter((c) => !have.includes(c));
      missing.length ? bad(`в таблице ${table} нет полей: ${missing.join(', ')}`) : ok(`таблица ${table}: поля на месте`);
    }
    const [fk] = await conn.query('SELECT constraint_name AS n FROM information_schema.referential_constraints WHERE constraint_schema = ? AND table_name = ?', [db, 'materials']);
    fk.length >= 2 ? ok('внешние ключи materials на месте') : bad('нет внешних ключей таблицы materials');

    try {
      const [[{ n: cats }]] = await conn.query('SELECT COUNT(*) AS n FROM categories');
      cats >= 5 ? ok(`категорий: ${cats}`) : bad(`категорий ${cats}, нужно минимум 5 (npm run db:init)`);
      const [[{ n: users }]] = await conn.query('SELECT COUNT(*) AS n FROM users');
      const [[{ n: admins }]] = await conn.query("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'");
      const [[{ n: mats }]] = await conn.query('SELECT COUNT(*) AS n FROM materials');
      ok(`пользователей: ${users}, материалов: ${mats}`);
      admins ? ok(`администраторов: ${admins}`) : warn('нет администратора: npm run create-admin -- admin admin@mail.ru ВашПароль');

      console.log('\nФайлы');
      const [files] = await conn.query("SELECT id, title, file_path FROM materials WHERE file_path LIKE '/uploads/%'");
      const inDb = new Set(files.map((f) => f.file_path));
      const missing = files.filter((f) => !fs.existsSync(path.join(UPLOADS, '..', f.file_path)));
      missing.length
        ? warn(`у ${missing.length} материалов нет файла на диске: ${missing.slice(0, 5).map((m) => `#${m.id}`).join(', ')}`)
        : ok('у всех материалов файлы на месте');

      let orphan = 0;
      for (const folder of ['images', 'videos', 'audio']) {
        const dir = path.join(UPLOADS, folder);
        if (!fs.existsSync(dir)) { bad(`нет папки uploads/${folder}`); continue; }
        for (const name of fs.readdirSync(dir)) {
          if (name.startsWith('.')) continue;
          if (!inDb.has(`/uploads/${folder}/${name}`)) {
            orphan++;
            if (FIX) fs.unlinkSync(path.join(dir, name));
          }
        }
      }
      orphan
        ? (FIX ? ok(`удалено лишних файлов: ${orphan}`) : warn(`лишних файлов в uploads (нет в базе): ${orphan}. Удалить: npm run check -- --fix`))
        : ok('лишних файлов в uploads нет');

      const tmp = path.join(UPLOADS, 'tmp');
      const tmpFiles = fs.existsSync(tmp) ? fs.readdirSync(tmp).filter((n) => !n.startsWith('.')) : [];
      if (tmpFiles.length) {
        if (FIX) { tmpFiles.forEach((n) => fs.unlinkSync(path.join(tmp, n))); ok(`очищена папка tmp: ${tmpFiles.length}`); }
        else warn(`в uploads/tmp лежат файлы: ${tmpFiles.length} (npm run check -- --fix)`);
      } else ok('папка uploads/tmp пуста');
    } catch (e) {
      bad(`ошибка проверки данных: ${e.message}`);
    }
    await conn.end();
  }

  console.log('\nИтог');
  console.log(fails ? `  Есть ошибки: ${fails}, предупреждений: ${warns}` : `  Всё в порядке${warns ? `, предупреждений: ${warns}` : ''}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('Ошибка проверки:', e.message); process.exit(1); });
