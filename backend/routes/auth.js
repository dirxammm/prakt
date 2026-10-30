const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const limiter = require('../utils/loginLimiter');

const router = express.Router();

const LOGIN_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const str = (v) => (v === undefined || v === null ? '' : String(v));

function makeToken(user) {
  return jwt.sign({ id: user.id, login: user.login, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });
}

// POST /api/auth/register — регистрация пользователя
router.post('/register', async (req, res) => {
  const body = req.body || {};
  const login = str(body.login).trim();
  const email = str(body.email).trim();
  const password = str(body.password);

  if (!login || !email || !password) {
    return res.status(400).json({ error: 'Заполните все поля: логин, e-mail и пароль' });
  }
  if (!LOGIN_RE.test(login)) {
    return res.status(400).json({ error: 'Логин: от 3 до 30 символов, только латинские буквы, цифры и «_»' });
  }
  if (!EMAIL_RE.test(email) || email.length > 100) {
    return res.status(400).json({ error: 'Некорректный адрес e-mail' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Пароль должен содержать не менее 6 символов' });
  }
  if (Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: 'Пароль слишком длинный (не более 72 байт)' });
  }

  const [exists] = await pool.query('SELECT login, email FROM users WHERE login = ? OR email = ?', [login, email]);
  if (exists.length) {
    const field = exists[0].login.toLowerCase() === login.toLowerCase() ? 'логином' : 'e-mail';
    return res.status(409).json({ error: `Пользователь с таким ${field} уже существует` });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.query('INSERT INTO users (login, email, password_hash) VALUES (?, ?, ?)', [login, email, hash]);
    res.status(201).json({ message: 'Регистрация выполнена', user: { id: result.insertId, login, email, role: 'user' } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Пользователь с таким логином или e-mail уже существует' });
    }
    throw e;
  }
});

// POST /api/auth/login — вход в аккаунт
router.post('/login', async (req, res) => {
  const body = req.body || {};
  const login = str(body.login).trim();
  const password = str(body.password);
  if (!login || !password) {
    return res.status(400).json({ error: 'Введите логин и пароль' });
  }

  // не более 10 неудачных попыток входа за 10 минут для одной пары «адрес + логин»
  const key = `${req.ip}|${login.toLowerCase()}`;
  const wait = limiter.check(key);
  if (wait) {
    return res.status(429).json({ error: `Слишком много неудачных попыток входа. Повторите через ${Math.ceil(wait / 60)} мин.` });
  }

  const [rows] = await pool.query('SELECT id, login, email, password_hash, role FROM users WHERE login = ?', [login]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    limiter.fail(key);
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  limiter.reset(key);
  res.json({
    token: makeToken(user),
    user: { id: user.id, login: user.login, email: user.email, role: user.role },
  });
});

// POST /api/auth/logout — выход из аккаунта (токен удаляется на стороне клиента)
router.post('/logout', authRequired, (req, res) => {
  res.json({ message: 'Выход выполнен' });
});

module.exports = router;
