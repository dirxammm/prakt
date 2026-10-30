// Ограничение числа неудачных попыток входа (защита от подбора пароля).
// Хранится в памяти сервера: после перезапуска счётчики сбрасываются.
const WINDOW_MS = 10 * 60 * 1000; // окно в 10 минут
const MAX_FAILS = 10;             // допустимо неудачных попыток за окно

const attempts = new Map(); // ключ -> { count, first }

// Возвращает, сколько секунд осталось до разблокировки (0 — вход разрешён)
function check(key) {
  const e = attempts.get(key);
  if (!e) return 0;
  if (Date.now() - e.first > WINDOW_MS) {
    attempts.delete(key);
    return 0;
  }
  return e.count >= MAX_FAILS ? Math.ceil((e.first + WINDOW_MS - Date.now()) / 1000) : 0;
}

function fail(key) {
  const e = attempts.get(key);
  if (!e || Date.now() - e.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else e.count++;
}

function reset(key) {
  attempts.delete(key);
}

setInterval(() => {
  for (const [k, e] of attempts) if (Date.now() - e.first > WINDOW_MS) attempts.delete(k);
}, WINDOW_MS).unref();

module.exports = { check, fail, reset, MAX_FAILS };
