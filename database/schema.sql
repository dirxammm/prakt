-- Схема базы данных веб-приложения «Мультимедийная галерея»
CREATE DATABASE IF NOT EXISTS multimedia_gallery
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE multimedia_gallery;

CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  login         VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id   INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS materials (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  description TEXT,
  type        ENUM('image', 'video', 'audio') NOT NULL,
  category_id INT NOT NULL,
  file_path   VARCHAR(500) NOT NULL,
  author_id   INT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_materials_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_materials_author   FOREIGN KEY (author_id)   REFERENCES users (id) ON DELETE CASCADE,
  INDEX idx_materials_type (type),
  INDEX idx_materials_author (author_id)
);
