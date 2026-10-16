const jwt = require('jsonwebtoken');

// Проверка токена авторизации (заголовок Authorization: Bearer <токен>)
function authRequired(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, login: payload.login, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Недействительный или просроченный токен' });
  }
}

// Доступ только для администратора (использовать после authRequired)
function adminRequired(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'Недостаточно прав' });
}

module.exports = { authRequired, adminRequired };
