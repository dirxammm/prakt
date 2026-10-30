// Автотест серверной части: npm run smoke
// Сам запускает сервер на свободном порту, создаёт временных пользователей (с приставкой smoke_),
// проверяет все маршруты и сообщения об ошибках, а затем удаляет за собой все данные и файлы.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { UPLOADS } = require('../utils/files');
const { scenePng, makeWav } = require('../utils/media');

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const SFX = Date.now().toString(36);
const U = { a: `smoke_a_${SFX}`, b: `smoke_b_${SFX}`, c: `smoke_c_${SFX}`, admin: `smoke_adm_${SFX}`, lock: `smoke_lock_${SFX}` };
const PASS = 'secret123';
const TMP = path.join(UPLOADS, 'tmp');

let passed = 0;
let failed = 0;
const t = (name, cond, detail) => {
  cond ? passed++ : failed++;
  console.log(`  [${cond ? ' OK ' : 'FAIL'}] ${name}${!cond && detail !== undefined ? '  -> ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
};
const section = (name) => console.log(`\n${name}`);

async function api(p, { method = 'GET', json, form, token, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(BASE + p, { method, headers: h, body });
  const text = Buffer.from(await res.arrayBuffer());
  let data = null;
  try { data = JSON.parse(text.toString('utf8')); } catch (e) { /* не JSON */ }
  return { status: res.status, data, headers: res.headers, raw: text };
}

function form(fields, file) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  if (file) f.append(file.field || 'file', new Blob([file.buf], { type: file.type }), file.name);
  return f;
}

const listTmp = () => (fs.existsSync(TMP) ? fs.readdirSync(TMP).filter((n) => !n.startsWith('.')) : []);
const diskPath = (filePath) => path.join(UPLOADS, '..', filePath);

async function waitForServer(child) {
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error('сервер завершился при запуске');
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) { /* ещё не запущен */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('сервер не запустился за 15 секунд');
}

async function cleanup() {
  const [mats] = await pool.query(
    "SELECT m.file_path FROM materials m JOIN users u ON u.id = m.author_id WHERE u.login LIKE ?", [`smoke\\_%\\_${SFX}`]);
  mats.forEach((m) => { if (m.file_path.startsWith('/uploads/')) fs.unlink(diskPath(m.file_path), () => {}); });
  await pool.query('DELETE FROM users WHERE login LIKE ?', [`smoke\\_%\\_${SFX}`]);
}

async function run() {
  const png = scenePng({ top: [90, 150, 220], bottom: [220, 235, 250], sun: [0.5, 0.3, 0.1], sunColor: [255, 245, 200] }, 200, 120);
  const wav = makeWav({ freq: 440, seconds: 1 });
  const fakeMp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypmp42'), Buffer.alloc(64)]);
  const tmpBefore = listTmp().length;

  section('Сервер и страницы');
  let r = await api('/api/health');
  t('GET /api/health', r.status === 200 && r.data && r.data.status === 'ok', r.status);
  r = await api('/api/categories');
  t('GET /api/categories: не меньше 5 категорий', r.status === 200 && Array.isArray(r.data) && r.data.length >= 5, r.status);
  const cats = r.data || [];
  const catPhoto = (cats.find((c) => c.name === 'Фотографии') || cats[0]).id;
  const catMusic = (cats.find((c) => c.name === 'Музыка') || cats[1]).id;
  const catStudy = (cats.find((c) => c.name === 'Обучение') || cats[2]).id;
  r = await api('/api/nothing');
  t('несуществующий маршрут API: 404 и сообщение', r.status === 404 && r.data && r.data.error === 'Маршрут не найден', r.status);
  r = await api('/nothing-' + SFX + '.html');
  t('несуществующая страница: 404', r.status === 404, r.status);
  r = await api('/');
  t('главная страница открывается', r.status === 200, r.status);
  t('заголовок X-Content-Type-Options: nosniff', r.headers.get('x-content-type-options') === 'nosniff');
  t('сервер не раскрывает X-Powered-By', !r.headers.get('x-powered-by'));

  section('Регистрация');
  r = await api('/api/auth/register', { method: 'POST', json: {} });
  t('пустые поля: 400', r.status === 400 && r.data.error === 'Заполните все поля: логин, e-mail и пароль', r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: 'a b', email: 'x@y.ru', password: PASS } });
  t('неверный логин: 400', r.status === 400 && /Логин/.test(r.data.error), r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: U.a, email: 'нет-собаки', password: PASS } });
  t('неверный e-mail: 400', r.status === 400 && r.data.error === 'Некорректный адрес e-mail', r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: U.a, email: `${U.a}@t.ru`, password: '123' } });
  t('короткий пароль: 400', r.status === 400 && /не менее 6/.test(r.data.error), r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: U.a, email: `${U.a}@t.ru`, password: 'x'.repeat(73) } });
  t('пароль длиннее 72 байт: 400', r.status === 400 && /72/.test(r.data.error), r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: U.a, email: `${U.a}@t.ru`, password: PASS } });
  t('успешная регистрация: 201', r.status === 201 && r.data.user && r.data.user.role === 'user' && !('password_hash' in r.data.user), r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: U.a, email: `other_${U.a}@t.ru`, password: PASS } });
  t('повторный логин: 409', r.status === 409 && /логином/.test(r.data.error), r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: U.b + '_x', email: `${U.a}@t.ru`, password: PASS } });
  t('повторный e-mail: 409', r.status === 409 && /e-mail/.test(r.data.error), r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: U.b, email: `${U.b}@t.ru`, password: PASS } });
  t('второй пользователь создан', r.status === 201, r.data);
  r = await api('/api/auth/register', { method: 'POST', json: { login: U.c, email: `${U.c}@t.ru`, password: PASS } });
  const hash = await bcrypt.hash(PASS, 10);
  await pool.query("INSERT INTO users (login, email, password_hash, role) VALUES (?, ?, ?, 'admin')", [U.admin, `${U.admin}@t.ru`, hash]);

  section('Вход и выход');
  r = await api('/api/auth/login', { method: 'POST', json: { login: U.a, password: 'wrong-pass' } });
  t('неверный пароль: 401', r.status === 401 && r.data.error === 'Неверный логин или пароль', r.data);
  r = await api('/api/auth/login', { method: 'POST', json: { login: 'no_such_' + SFX, password: PASS } });
  t('неизвестный логин: то же сообщение 401', r.status === 401 && r.data.error === 'Неверный логин или пароль', r.data);
  r = await api('/api/auth/login', { method: 'POST', json: {} });
  t('пустая форма входа: 400', r.status === 400 && r.data.error === 'Введите логин и пароль', r.data);
  const login = async (u) => (await api('/api/auth/login', { method: 'POST', json: { login: u, password: PASS } }));
  r = await login(U.a);
  t('успешный вход: токен и пользователь', r.status === 200 && r.data.token && r.data.user.login === U.a, r.data);
  const ta = r.data && r.data.token;
  const tb = (await login(U.b)).data.token;
  const tc = (await login(U.c)).data.token;
  const tadm = (await login(U.admin)).data.token;
  t('роль администратора в ответе входа', (await login(U.admin)).data.user.role === 'admin');
  r = await api('/api/auth/logout', { method: 'POST', token: ta });
  t('выход: 200', r.status === 200 && r.data.message === 'Выход выполнен', r.data);
  let last;
  for (let i = 0; i < 10; i++) last = await api('/api/auth/login', { method: 'POST', json: { login: U.lock, password: 'bad-' + i } });
  t('10 неудачных попыток подряд: ещё 401', last.status === 401, last.status);
  last = await api('/api/auth/login', { method: 'POST', json: { login: U.lock, password: 'bad-11' } });
  t('11-я попытка: блокировка 429', last.status === 429 && /Слишком много/.test(last.data.error), last.data);

  section('Личный кабинет и токены');
  r = await api('/api/users/me');
  t('без токена: 401', r.status === 401 && r.data.error === 'Требуется авторизация', r.data);
  r = await api('/api/users/me', { token: 'garbage.token.value' });
  t('неверный токен: 401', r.status === 401 && /Недействительный/.test(r.data.error), r.data);
  r = await api('/api/users/me', { token: ta });
  t('кабинет: данные пользователя без пароля', r.status === 200 && r.data.user.login === U.a && !('password_hash' in r.data.user) && Array.isArray(r.data.materials), r.data);

  section('Добавление материалов');
  r = await api('/api/materials', { method: 'POST', form: form({ title: 'x', type: 'image', category_id: catPhoto }) });
  t('без авторизации: 401', r.status === 401, r.status);
  const base = { description: 'Тестовое описание', category_id: catPhoto };
  const img = { buf: png, type: 'image/png', name: 'тест.PNG' };
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, type: 'image' }, img) });
  t('без названия: 400', r.status === 400 && r.data.error === 'Укажите название материала', r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x'.repeat(151), type: 'image' }, img) });
  t('название длиннее 150 символов: 400', r.status === 400, r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'doc' }, img) });
  t('неверный тип: 400', r.status === 400 && /тип материала/.test(r.data.error), r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ title: 'x', type: 'image' }, img) });
  t('без категории: 400', r.status === 400 && r.data.error === 'Выберите категорию', r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'image', category_id: 999999 }, img) });
  t('несуществующая категория: 400', r.status === 400 && /не существует/.test(r.data.error), r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'image' }) });
  t('изображение без файла: 400', r.status === 400 && r.data.error === 'Загрузите файл', r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'image' }, { buf: Buffer.from('текст'), type: 'text/plain', name: 'a.txt' }) });
  t('неподдерживаемый формат (.txt): 400', r.status === 400 && /Неподдерживаемый формат файла/.test(r.data.error), r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'audio' }, img) });
  t('формат не соответствует типу: 400', r.status === 400 && /не соответствует/.test(r.data.error), r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'image' }, { buf: Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024)]), type: 'image/png', name: 'big.png' }) });
  t('изображение больше 10 МБ: 400', r.status === 400 && /Максимальный размер: 10 МБ/.test(r.data.error), r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'image' }, { ...img, field: 'photo' }) });
  t('файл в неверном поле: 400', r.status === 400 && /поле file/.test(r.data.error), r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'video', link: 'ftp://evil' }) });
  t('некорректная ссылка на видео: 400', r.status === 400 && r.data.error === 'Некорректная ссылка на видео', r.data);
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: 'x', type: 'video' }) });
  t('видео без файла и ссылки: 400', r.status === 400 && /видеофайл или укажите ссылку/.test(r.data.error), r.data);

  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: `Закат ${SFX}`, type: 'image' }, img) });
  t('изображение (PNG, имя в верхнем регистре с русскими буквами): 201', r.status === 201 && /^\/uploads\/images\/.+\.png$/.test(r.data.file_path), r.data);
  const mImg = r.data;
  r = await api('/api/materials', { method: 'POST', token: tb, form: form({ ...base, category_id: catMusic, title: `Мелодия ${SFX}`, type: 'audio' }, { buf: wav, type: 'audio/wav', name: 'a.wav' }) });
  t('аудио (WAV): 201', r.status === 201 && /^\/uploads\/audio\/.+\.wav$/.test(r.data.file_path), r.data);
  const mAud = r.data;
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, category_id: catStudy, title: `Урок ${SFX}`, type: 'video' }, { buf: fakeMp4, type: 'video/mp4', name: 'v.mp4' }) });
  t('видеофайл (MP4): 201', r.status === 201 && /^\/uploads\/videos\/.+\.mp4$/.test(r.data.file_path), r.data);
  const mVid = r.data;
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, category_id: catStudy, title: `Ссылка ${SFX}`, type: 'video', link: 'https://example.com/v.mp4' }) });
  t('видео по ссылке: 201', r.status === 201 && r.data.file_path === 'https://example.com/v.mp4', r.data);
  const mLink = r.data;
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: `ab_c ${SFX}`, type: 'image' }, img) });
  const mUnd = r.data;
  r = await api('/api/materials', { method: 'POST', token: ta, form: form({ ...base, title: `abxc ${SFX}`, type: 'image' }, img) });
  t('для всех созданных материалов файлы лежат на диске',
    [mImg, mAud, mVid, mUnd, r.data].every((m) => m && fs.existsSync(diskPath(m.file_path))));

  section('Просмотр, поиск и фильтры');
  r = await api(`/api/materials/${mImg.id}`);
  t('материал по номеру: все поля', r.status === 200 && r.data.title === `Закат ${SFX}` && r.data.author === U.a && r.data.category && r.data.created_at, r.data);
  r = await api('/api/materials/99999999');
  t('несуществующий материал: 404', r.status === 404 && r.data.error === 'Материал не найден', r.data);
  r = await api('/api/materials/abc');
  t('номер не числом: 404', r.status === 404, r.status);
  const titles = async (qs) => { const x = await api('/api/materials' + qs); return x.status === 200 ? x.data.map((m) => m.title).sort() : x; };
  t('поиск по уникальной части названия (6 материалов)', (await titles(`?q=${SFX}`)).length === 6);
  t('поиск без учёта регистра', (await titles(`?q=${encodeURIComponent('ЗАКАТ ' + SFX)}`)).join() === `Закат ${SFX}`);
  t('символ _ в поиске ищется буквально', (await titles(`?q=${encodeURIComponent('ab_c ' + SFX)}`)).join() === `ab_c ${SFX}`);
  t('символ % в поиске не работает как маска', (await titles(`?q=${encodeURIComponent('%' + SFX)}`)).length === 0);
  t('SQL-инъекция в поиске безопасна', (await titles(`?q=${encodeURIComponent("' OR '1'='1")}`)).length === 0);
  t('фильтр по типу: audio', (await titles(`?type=audio&q=${SFX}`)).join() === `Мелодия ${SFX}`);
  t('фильтр по категории: Музыка', (await titles(`?category=${catMusic}&q=${SFX}`)).join() === `Мелодия ${SFX}`);
  t('тип + категория без совпадений: пустой список', (await titles(`?type=image&category=${catMusic}&q=${SFX}`)).length === 0);
  r = await api('/api/materials?type=foo');
  t('неверный тип в фильтре: 400', r.status === 400 && /Неверный тип/.test(r.data.error), r.data);
  r = await api('/api/materials?category=abc');
  t('неверная категория в фильтре: 400', r.status === 400 && r.data.error === 'Неверный номер категории', r.data);
  r = await api('/api/materials?q=' + 'a'.repeat(101));
  t('поисковый запрос длиннее 100 символов: 400', r.status === 400, r.data);
  r = await api('/api/users/me', { token: ta });
  t('в кабинете автора видны его материалы (5)', r.data.materials.length === 5, r.data.materials && r.data.materials.length);

  section('Отдача файлов');
  r = await api(mAud.file_path);
  t('файл открывается, тип audio/wav', r.status === 200 && /audio\/wav|audio\/x-wav/.test(r.headers.get('content-type')), r.headers.get('content-type'));
  r = await api(mAud.file_path, { headers: { Range: 'bytes=0-99' } });
  t('Range-запрос: 206 Partial Content (перемотка работает)', r.status === 206 && /^bytes 0-99\//.test(r.headers.get('content-range') || '') && r.raw.length === 100, r.status);
  t('у файла заголовок nosniff', r.headers.get('x-content-type-options') === 'nosniff');
  r = await api(mImg.file_path);
  t('изображение: image/png', r.status === 200 && r.headers.get('content-type') === 'image/png', r.headers.get('content-type'));

  section('Удаление');
  r = await api(`/api/materials/${mImg.id}`, { method: 'DELETE' });
  t('без авторизации: 401', r.status === 401, r.status);
  r = await api(`/api/materials/${mImg.id}`, { method: 'DELETE', token: tb });
  t('чужой материал: 403', r.status === 403 && /только свои/.test(r.data.error), r.data);
  r = await api(`/api/materials/${mImg.id}`, { method: 'DELETE', token: ta });
  t('свой материал: 200', r.status === 200 && r.data.message === 'Материал удалён', r.data);
  await new Promise((x) => setTimeout(x, 300));
  t('файл удалён с диска', !fs.existsSync(diskPath(mImg.file_path)));
  r = await api(`/api/materials/${mImg.id}`, { method: 'DELETE', token: ta });
  t('повторное удаление: 404', r.status === 404, r.status);
  r = await api(`/api/materials/${mLink.id}`, { method: 'DELETE', token: ta });
  t('видео-ссылка удаляется без ошибок', r.status === 200, r.data);

  section('Администратор');
  r = await api('/api/admin/users');
  t('без токена: 401', r.status === 401, r.status);
  r = await api('/api/admin/users', { token: ta });
  t('обычный пользователь: 403', r.status === 403 && r.data.error === 'Недостаточно прав', r.data);
  r = await api('/api/admin/users', { token: tadm });
  const me = r.data && r.data.find((u) => u.login === U.a);
  t('список пользователей с materials_count', r.status === 200 && me && typeof me.materials_count === 'number' && me.materials_count === 3 && !('password_hash' in me), me);
  r = await api(`/api/admin/materials?q=${SFX}&type=audio`, { token: tadm });
  t('все материалы: поиск и фильтр по типу', r.status === 200 && r.data.length === 1 && r.data[0].author === U.b, r.data);
  r = await api('/api/admin/materials?type=foo', { token: tadm });
  t('неверный фильтр в админке: 400', r.status === 400, r.data);
  r = await api(`/api/admin/materials/${mAud.id}`, { method: 'DELETE', token: tadm });
  t('удаление чужого материала администратором: 200', r.status === 200, r.data);
  await new Promise((x) => setTimeout(x, 300));
  t('файл удалённого администратором материала убран с диска', !fs.existsSync(diskPath(mAud.file_path)));
  r = await api('/api/admin/materials/99999999', { method: 'DELETE', token: tadm });
  t('удаление несуществующего: 404', r.status === 404, r.status);
  r = await api(`/api/materials/${mVid.id}`, { method: 'DELETE', token: tadm });
  t('администратор может удалить материал и обычным маршрутом', r.status === 200, r.data);

  section('Надёжность');
  const [[{ id: cid }]] = await pool.query('SELECT id FROM users WHERE login = ?', [U.c]).then(([rows]) => [rows]);
  await pool.query('DELETE FROM users WHERE id = ?', [cid]);
  const imagesBefore = fs.readdirSync(path.join(UPLOADS, 'images')).length;
  r = await api('/api/materials', { method: 'POST', token: tc, form: form({ ...base, title: 'призрак', type: 'image' }, img) });
  t('токен удалённого пользователя: 401, не 500', r.status === 401 && /Войдите заново/.test(r.data.error), r.data);
  await new Promise((x) => setTimeout(x, 300));
  t('после этого лишний файл не остался', fs.readdirSync(path.join(UPLOADS, 'images')).length === imagesBefore);
  t('папка uploads/tmp не накапливает файлы после отказов', listTmp().length === tmpBefore, listTmp());
}

(async () => {
  console.log(`Автотест серверной части (порт ${PORT})`);
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });
  try {
    await waitForServer(server);
    await run();
    const bad = log.split('\n').filter((l) => /Error|at .*\(.*:\d+:\d+\)/.test(l));
    section('Журнал сервера');
    t('сервер не писал ошибок в журнал', bad.length === 0, bad.slice(0, 3));
  } catch (e) {
    failed++;
    console.log(`  [FAIL] тест прерван: ${e.message}`);
  } finally {
    server.kill();
    try { await cleanup(); } catch (e) { console.log(`  не удалось очистить тестовые данные: ${e.message}`); }
    await pool.end();
  }
  console.log(`\nИтог: пройдено ${passed}, провалено ${failed}`);
  process.exit(failed ? 1 : 0);
})();
