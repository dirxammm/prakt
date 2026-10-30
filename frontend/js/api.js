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
      // Недействительный или истёкший токен — очищаем данные входа и
      // переходим на вход, чтобы пользователь не остался «авторизованным».
      // Исключение — сама страница входа и выход (там токена может уже не быть).
      if (res.status === 401 && token &&
          location.pathname !== '/login.html' && !path.includes('/auth/logout')) {
        auth.clear();
        if (!/\/(login|register)\.html$/.test(location.pathname)) {
          window.location.href = '/login.html?next=' + encodeURIComponent(location.pathname + location.search);
        }
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
    materials(params) {
      // params: { type?, category?, q? } или строка-type для совместимости
      if (!params) return request('/api/materials');
      if (typeof params === 'string') params = { type: params };
      const q = [];
      if (params.type)     q.push('type=' + encodeURIComponent(params.type));
      if (params.category) q.push('category=' + encodeURIComponent(params.category));
      if (params.q)        q.push('q=' + encodeURIComponent(params.q));
      return request('/api/materials' + (q.length ? '?' + q.join('&') : ''));
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
    adminMaterials(params) {
      if (!params) return request('/api/admin/materials');
      const q = [];
      if (params.type) q.push('type=' + encodeURIComponent(params.type));
      if (params.q)    q.push('q=' + encodeURIComponent(params.q));
      return request('/api/admin/materials' + (q.length ? '?' + q.join('&') : ''));
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

  // Безопасный next: разрешаем только внутренние относительные пути (/*),
  // чтобы параметр ?next=https://… не увёл пользователя наружу.
  function safeNext(value) {
    if (!value) return null;
    if (!/^\/(?![\/\\])[^\s\u0000-\u001f]*$/.test(value)) return null; // не «//», не «/\», без пробелов и управляющих символов
    return value;
  }

  // Toast-уведомления (замена alert). Контейнер создаётся при первом вызове.
  function toast(message, kind) {
    let box = qs('#toast-container');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toast-container';
      box.className = 'toast-container';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'info');
    el.textContent = message;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  // Модальное подтверждение (замена confirm). Возвращает Promise<boolean>.
  function confirmDialog(message, { confirmText = 'Удалить', cancelText = 'Отмена', danger = true } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" role="dialog" aria-modal="true">
          <p class="modal-message">${escapeHtml(message)}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-cancel>${escapeHtml(cancelText)}</button>
            <button class="btn ${danger ? 'btn-danger' : ''}" data-confirm>${escapeHtml(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));
      const close = (value) => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 200);
        resolve(value);
      };
      overlay.querySelector('[data-cancel]').addEventListener('click', () => close(false));
      overlay.querySelector('[data-confirm]').addEventListener('click', () => close(true));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
      document.addEventListener('keydown', function esc(ev) {
        if (ev.key === 'Escape') { document.removeEventListener('keydown', esc); close(false); }
      });
    });
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
      // В next кладём только относительный путь — иначе ссылка на внешний сайт
      // могла бы увести пользователя после входа.
      const next = location.pathname + location.search;
      window.location.href = (redirect || '/login.html') + '?next=' + encodeURIComponent(safeNext(next) || '/profile.html');
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
                showNotice, hideNotice, getParam, safeNext, toast, confirmDialog,
                requireAuth, init };
})();
