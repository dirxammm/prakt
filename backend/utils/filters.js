const TYPES = ['image', 'video', 'audio'];

// Разбирает параметры ?type=, ?category=, ?q= и собирает условия для SQL-запроса.
// Возвращает { error } при неверных параметрах или { clause, params } для подстановки в запрос.
function parseFilters(query) {
  const type = query.type || undefined;
  const category = query.category || undefined;
  const q = query.q === undefined ? '' : String(query.q).trim();

  if (type !== undefined && !TYPES.includes(type)) {
    return { error: 'Неверный тип материала. Допустимо: image, video, audio' };
  }
  if (category !== undefined && !/^\d+$/.test(String(category))) {
    return { error: 'Неверный номер категории' };
  }
  if (q.length > 100) {
    return { error: 'Поисковый запрос не должен быть длиннее 100 символов' };
  }

  const where = [];
  const params = [];
  if (type) {
    where.push('m.type = ?');
    params.push(type);
  }
  if (category) {
    where.push('m.category_id = ?');
    params.push(category);
  }
  if (q) {
    // символы %, _ и \ в строке поиска экранируются и ищутся как обычные
    where.push('m.title LIKE ?');
    params.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%');
  }
  return { clause: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

module.exports = { parseFilters };
