-- Начальные данные: категории материалов
USE multimedia_gallery;

INSERT IGNORE INTO categories (name) VALUES
  ('Фотографии'),
  ('Музыка'),
  ('Обучение'),
  ('Развлечения'),
  ('Другое');
