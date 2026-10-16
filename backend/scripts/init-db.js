// Создаёт базу данных, таблицы и категории: npm run db:init
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
    charset: 'utf8mb4',
  });
  const dir = path.join(__dirname, '..', '..', 'database');
  for (const file of ['schema.sql', 'seed.sql']) {
    await conn.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    console.log(`Выполнен ${file}`);
  }
  await conn.end();
  console.log('База данных готова');
})().catch((e) => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
