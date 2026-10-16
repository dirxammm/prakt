const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { ROOT } = require('../utils/files');

const UPLOADS = path.join(ROOT, 'uploads');
const FOLDERS = { image: 'images', video: 'videos', audio: 'audio' };

// Допустимые форматы и ограничения по размеру (в байтах)
const RULES = {
  image: { ext: ['.jpg', '.jpeg', '.png', '.webp'], mime: ['image/jpeg', 'image/png', 'image/webp'], max: 10 * 1024 * 1024 },
  video: { ext: ['.mp4'], mime: ['video/mp4'], max: 100 * 1024 * 1024 },
  audio: { ext: ['.mp3', '.wav'], mime: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave'], max: 20 * 1024 * 1024 },
};

const TMP = path.join(UPLOADS, 'tmp');
Object.values(FOLDERS).concat('tmp').forEach((f) => fs.mkdirSync(path.join(UPLOADS, f), { recursive: true }));

// Определяет тип материала по формату файла (null, если формат не поддерживается)
function detectType(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  return Object.keys(RULES).find((t) => RULES[t].ext.includes(ext) && RULES[t].mime.includes(file.mimetype)) || null;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: TMP,
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: RULES.video.max, files: 1 },
  fileFilter: (req, file, cb) => {
    if (detectType(file)) return cb(null, true);
    const err = new Error('Неподдерживаемый формат файла. Допустимо: JPG, PNG, WEBP, MP4, MP3, WAV');
    err.code = 'INVALID_FILE_TYPE';
    cb(err);
  },
});

// Переносит проверенный файл из временной папки в папку своего типа, возвращает путь для БД
function moveToFolder(file, type) {
  const target = path.join(UPLOADS, FOLDERS[type], file.filename);
  fs.renameSync(file.path, target);
  return `/uploads/${FOLDERS[type]}/${file.filename}`;
}

function discard(file) {
  if (file) fs.unlink(file.path, () => {});
}

module.exports = { upload, RULES, detectType, moveToFolder, discard };
