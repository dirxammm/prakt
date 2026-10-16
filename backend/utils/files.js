const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

// Удаляет загруженный файл с диска (внешние ссылки на видео не затрагиваются)
function removeUploadedFile(filePath) {
  if (!filePath || !filePath.startsWith('/uploads/')) return;
  const abs = path.join(ROOT, filePath);
  if (abs.startsWith(path.join(ROOT, 'uploads'))) {
    fs.unlink(abs, () => {});
  }
}

module.exports = { removeUploadedFile, ROOT };
