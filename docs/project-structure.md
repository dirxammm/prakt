# Структура проекта

```
prakt/
├── README.md                      — обзор проекта и инструкция запуска
├── .gitignore                     — список исключений Git
├── backend/                       — серверная часть (Node.js + Express)
│   ├── server.js                  — точка входа, подключение маршрутов и статики
│   ├── config/db.js               — пул соединений MySQL
│   ├── middleware/
│   │   ├── auth.js                — JWT-авторизация, проверка прав админа
│   │   └── upload.js              — multer, валидация форматов и лимитов
│   ├── routes/
│   │   ├── auth.js                — регистрация, вход, выход
│   │   ├── users.js               — личный кабинет (/api/users/me)
│   │   ├── categories.js          — список категорий
│   │   ├── materials.js           — CRUD материалов
│   │   └── admin.js               — административные маршруты
│   ├── scripts/
│   │   ├── init-db.js             — создание БД и таблиц
│   │   └── create-admin.js        — создание учётной записи администратора
│   ├── utils/files.js             — вспомогательные функции (пути, удаление файлов)
│   ├── package.json / .env.example
├── database/
│   ├── schema.sql                 — DDL таблиц
│   └── seed.sql                   — начальные категории
├── frontend/                      — клиентская часть (HTML/CSS/JS)
│   ├── index.html                 — главная страница
│   ├── login.html / register.html — формы входа и регистрации
│   ├── profile.html               — личный кабинет
│   ├── gallery.html               — общая галерея с фильтром и поиском
│   ├── material.html              — просмотр одного материала
│   ├── upload.html                — добавление материала
│   ├── admin.html                 — админ-панель
│   ├── 404.html                   — страница «не найдено»
│   ├── css/style.css              — общие стили
│   └── js/api.js                  — работа с API, шапка, авторизация
├── uploads/                       — хранилище загружаемых файлов
│   ├── images/ · videos/ · audio/
│   └── tmp/                       — временная папка для multer
├── tests/
│   ├── test-plan.md               — план тестирования
│   ├── test-cases.md              — тест-кейсы
│   └── bug-journal.md             — журнал выявленных замечаний
└── docs/
    ├── project-structure.md       — настоящий документ
    ├── api-plan.md                — описание REST-эндпоинтов
    ├── requirements.md            — функциональные требования
    └── meeting-notes/             — краткие протоколы встреч команды
```
