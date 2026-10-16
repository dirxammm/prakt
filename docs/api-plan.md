# План API — «Мультимедийная галерея»

Базовый адрес: `http://localhost:3000`. Формат обмена — JSON (загрузка материала — `multipart/form-data`).
Авторизация: заголовок `Authorization: Bearer <токен>`. Ошибки: `{ "error": "описание" }`.

| Метод и путь | Доступ | Назначение |
|---|---|---|
| POST /api/auth/register | все | регистрация (login, email, password) |
| POST /api/auth/login | все | вход (login, password), ответ: token и user |
| POST /api/auth/logout | авторизованный | выход (токен удаляется на клиенте) |
| GET /api/users/me | авторизованный | данные пользователя и его материалы |
| GET /api/categories | все | список категорий |
| GET /api/materials | все | список материалов, фильтр `?type=image\|video\|audio` |
| GET /api/materials/:id | все | один материал |
| POST /api/materials | авторизованный | добавление: title, description, category_id, type, file или link (видео) |
| DELETE /api/materials/:id | автор или админ | удаление материала |
| GET /api/admin/users | админ | список пользователей |
| GET /api/admin/materials | админ | все материалы |
| DELETE /api/admin/materials/:id | админ | удаление любого материала |

Типы материалов: `image`, `video`, `audio`.
Форматы и размеры: изображения JPG/PNG/WEBP до 10 МБ, видео MP4 до 100 МБ, аудио MP3/WAV до 20 МБ.
Коды ответов: 200/201 — успех, 400 — ошибка данных, 401 — нет авторизации, 403 — нет прав, 404 — не найдено, 409 — дубликат, 500 — ошибка сервера.
