// Создаёт базу данных, таблицы, индексы и категории: npm run db:init
// Безопасно запускать повторно: существующие данные не удаляются.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Индексы, которые должны быть в БД (добавляются, если базу создали по старой схеме)
const INDEXES = [
  { table: 'materials', name: 'idx_materials_type', columns: 'type' },
  { table: 'materials', name: 'idx_materials_author', columns: 'author_id' },
  { table: 'materials', name: 'idx_materials_created', columns: 'created_at' },
];

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

  const db = process.env.DB_NAME || 'multimedia_gallery';
  await conn.query(`USE \`${db}\``);
  for (const ix of INDEXES) {
    const [rows] = await conn.query(
      'SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
      [db, ix.table, ix.name]
    );
    if (!rows.length) {
      await conn.query(`ALTER TABLE \`${ix.table}\` ADD INDEX \`${ix.name}\` (\`${ix.columns}\`)`);
      console.log(`Добавлен индекс ${ix.name}`);
    }
  }
  await conn.end();
  console.log('База данных готова');
})().catch((e) => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
