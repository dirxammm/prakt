// Клиентская часть «Мультимедийной галереи» — работа с API и общими данными.
// Хранение токена и пользователя в localStorage.

(function () {
  const TOKEN_KEY = 'mg_token';
  const USER_KEY = 'mg_user';

  const auth = {
    getToken() {
      return localStorage.getItem(TOKEN_KEY);
    },
    getUser() {
      try {
        return JSON.parse(localStorage.getItem(USER_KEY));
      } catch (e) {
        return null;
      }
    },
    isAuthorized() {
      return !!this.getToken();
    },
    isAdmin() {
      const u = this.getUser();
      return !!u && u.role === 'admin';
    },
    save(token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  };

  async function request(path, options = {}) {
    const opts = Object.assign({ method: 'GET', headers: {} }, options);
    const token = auth.getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (opts.body && !(opts.body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      if (typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(path, opts);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      // токен недействителен или просрочен: очищаем данные входа и отправляем на страницу входа
      if (res.status === 401 && token && !path.startsWith('/api/auth/')) {
        auth.clear();
        window.location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      }
      const err = new Error((data && data.error) || 'Ошибка сервера');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const api = {
    register(login, email, password) {
      return request('/api/auth/register', { method: 'POST', body: { login, email, password } });
    },
    login(login, password) {
      return request('/api/auth/login', { method: 'POST', body: { login, password } });
    },
    logout() {
      return request('/api/auth/logout', { method: 'POST' }).catch(() => null);
    },
    me() {
      return request('/api/users/me');
    },
    categories() {
      return request('/api/categories');
    },
    // materials() — все; materials('audio') — по типу; materials({ type, category, q }) — с фильтрами и поиском
    materials(params) {
      const p = typeof params === 'string' ? { type: params } : params || {};
      const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString();
      return request('/api/materials' + (qs ? '?' + qs : ''));
    },
    material(id) {
      return request('/api/materials/' + encodeURIComponent(id));
    },
    uploadMaterial(formData) {
      return request('/api/materials', { method: 'POST', body: formData });
    },
    deleteMaterial(id) {
      return request('/api/materials/' + encodeURIComponent(id), { method: 'DELETE' });
    },
    adminUsers() {
      return request('/api/admin/users');
    },
    adminMaterials() {
      return request('/api/admin/materials');
    },
    adminDeleteMaterial(id) {
      return request('/api/admin/materials/' + encodeURIComponent(id), { method: 'DELETE' });
    },
  };

  // Общие помощники для UI
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function typeIcon(type) {
    return { image: '🖼️', video: '🎬', audio: '🎵' }[type] || '📄';
  }
  function typeLabel(type) {
    return { image: 'Изображение', video: 'Видео', audio: 'Аудио' }[type] || type;
  }
  function showNotice(sel, message, kind) {
    const el = typeof sel === 'string' ? qs(sel) : sel;
    if (!el) return;
    el.textContent = message;
    el.className = 'notice show ' + (kind || 'error');
  }
  function hideNotice(sel) {
    const el = typeof sel === 'string' ? qs(sel) : sel;
    if (!el) return;
    el.textContent = '';
    el.className = 'notice';
  }
  function getParam(name) {
    return new URL(window.location.href).searchParams.get(name);
  }

  // Шапка: отрисовка меню и состояния авторизации
  function renderHeader() {
    const user = auth.getUser();
    const authorized = auth.isAuthorized();
    const admin = auth.isAdmin();
    const html = `
      <header class="header">
        <div class="header-inner">
          <a href="/index.html" class="logo"><span class="logo-mark">◉</span> Галерея</a>
          <button class="burger" id="burger" aria-label="Меню">☰</button>
          <nav class="menu" id="menu">
            <a href="/gallery.html">Галерея</a>
            <a href="/gallery.html?type=image">Изображения</a>
            <a href="/gallery.html?type=video">Видео</a>
            <a href="/gallery.html?type=audio">Аудио</a>
            ${authorized ? '<a href="/upload.html">Добавить</a>' : ''}
            ${admin ? '<a href="/admin.html">Админ</a>' : ''}
          </nav>
          <div class="auth-area">
            ${authorized
              ? `<a href="/profile.html" class="user-name">${escapeHtml(user.login)}</a>
                 <button class="btn-link btn-sm" style="background:none;border:0;cursor:pointer;color:var(--text);opacity:0.88;font-family:inherit;" id="logout-btn">Выйти</button>`
              : `<a href="/login.html" style="color:var(--text);opacity:0.88;font-size:12px;">Войти</a>
                 <a href="/register.html" style="color:var(--accent);font-size:12px;">Создать аккаунт ›</a>`}
          </div>
        </div>
      </header>`;
    const placeholder = qs('#header-placeholder');
    if (placeholder) placeholder.outerHTML = html;
    // обработчики
    const burger = qs('#burger');
    const menu = qs('#menu');
    if (burger && menu) burger.addEventListener('click', () => menu.classList.toggle('open'));
    const logoutBtn = qs('#logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
      await api.logout();
      auth.clear();
      window.location.href = '/index.html';
    });
  }

  function renderFooter() {
    const html = `<footer class="footer"><div class="footer-inner">Copyright © 2026 Мультимедийная галерея. Проект учебной практики.</div></footer>`;
    const placeholder = qs('#footer-placeholder');
    if (placeholder) placeholder.outerHTML = html;
  }

  function requireAuth(redirect) {
    if (!auth.isAuthorized()) {
      window.location.href = (redirect || '/login.html') + '?next=' + encodeURIComponent(location.pathname + location.search);
      return false;
    }
    return true;
  }

  // Инициализация страницы (вызывается на DOMContentLoaded)
  function init(opts) {
    document.addEventListener('DOMContentLoaded', () => {
      renderHeader();
      renderFooter();
      if (opts && opts.requireAuth && !requireAuth()) return;
      if (opts && typeof opts.onReady === 'function') opts.onReady();
    });
  }

  window.MG = { api, auth, qs, qsa, formatDate, escapeHtml, typeIcon, typeLabel,
                showNotice, hideNotice, getParam, requireAuth, init };
})();
