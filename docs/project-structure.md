# Структура проекта (финальная версия)

```
prakt/
├── README.md                              — обзор проекта, запуск, команды npm
├── .gitignore                             — исключения Git
├── backend/                               — серверная часть (Node.js + Express 5)
│   ├── server.js                          — точка входа: статика, маршруты, обработка ошибок, graceful shutdown
│   ├── .env.example                       — пример файла окружения
│   ├── package.json                       — зависимости и команды npm
│   ├── config/
│   │   └── db.js                          — пул соединений MySQL
│   ├── middleware/
│   │   ├── auth.js                        — JWT, authRequired, adminRequired
│   │   └── upload.js                      — multer, валидация форматов и размеров
│   ├── routes/
│   │   ├── auth.js                        — регистрация, вход, выход, ограничение попыток
│   │   ├── users.js                       — личный кабинет (/api/users/me)
│   │   ├── categories.js                  — список категорий
│   │   ├── materials.js                   — CRUD материалов + серверный поиск и фильтры
│   │   └── admin.js                       — административные маршруты
│   ├── utils/
│   │   ├── files.js                       — удаление загруженных файлов, очистка tmp/
│   │   ├── filters.js                     — разбор ?type, ?category, ?q
│   │   ├── loginLimiter.js                — ограничение числа неудачных попыток входа
│   │   └── media.js                       — генерация PNG и WAV для seed-demo
│   └── scripts/
│       ├── init-db.js                     — создание БД, таблиц, начальных категорий
│       ├── create-admin.js                — создание учётной записи администратора
│       ├── check.js                       — проверка окружения, БД, uploads (npm run check)
│       ├── smoke-test.js                  — автотест всех маршрутов API (npm run smoke)
│       └── seed-demo.js                   — демо-пользователи и материалы (npm run seed-demo)
├── database/
│   ├── schema.sql                         — DDL таблиц (ENGINE=InnoDB, индексы)
│   └── seed.sql                           — начальные категории
├── frontend/                              — клиентская часть (HTML/CSS/JS)
│   ├── index.html                         — главная
│   ├── login.html / register.html         — формы входа и регистрации
│   ├── profile.html                       — личный кабинет
│   ├── gallery.html                       — галерея с серверным поиском и фильтрами
│   ├── material.html                      — просмотр материала, lightbox, похожие
│   ├── upload.html                        — форма добавления
│   ├── admin.html                         — админ-панель
│   ├── 404.html                           — страница «не найдено»
│   ├── css/style.css                      — единые стили (Apple-подобная тема)
│   └── js/api.js                          — модуль MG: API, auth, шапка, модалки, toast
├── uploads/                               — хранилище файлов пользователей
│   ├── images/ · videos/ · audio/         — по типу материала
│   └── tmp/                               — временная папка multer (очищается при старте)
├── tests/
│   ├── test-plan.md                       — план тестирования
│   ├── test-cases.md                      — кейсы 2 недели (32 шт.)
│   ├── test-cases-week3.md                — кейсы 3 недели (36 шт.)
│   ├── test-cases-week4.md                — приёмка 4 недели (30 шт.)
│   └── bug-journal.md                     — журнал замечаний (B-01…B-26, все устранены)
└── docs/
    ├── requirements.md                    — функциональные требования
    ├── project-structure.md               — настоящий документ
    ├── api-plan.md                        — описание REST-эндпоинтов
    ├── backend.md                         — архитектура и команды серверной части
    ├── database.md                        — описание схемы БД
    └── user-guide.md                      — руководство и сценарий видеопрезентации
```
