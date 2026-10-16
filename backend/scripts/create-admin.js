// Создаёт администратора: npm run create-admin -- <логин> <email> <пароль>
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const pool = require('../config/db');

(async () => {
  const [login, email, password] = process.argv.slice(2);
  if (!login || !email || !password) {
    console.log('Использование: npm run create-admin -- <логин> <email> <пароль>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (login, email, password_hash, role) VALUES (?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE role = 'admin', password_hash = VALUES(password_hash)`,
    [login, email, hash]
  );
  console.log(`Администратор «${login}» создан`);
  await pool.end();
})().catch((e) => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
