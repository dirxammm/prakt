const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const UPLOADS = path.join(ROOT, 'uploads');

// Удаляет загруженный файл с диска (внешние ссылки на видео не затрагиваются)
function removeUploadedFile(filePath) {
  if (!filePath || !filePath.startsWith('/uploads/')) return;
  const abs = path.join(ROOT, filePath);
  if (abs.startsWith(UPLOADS + path.sep)) {
    fs.unlink(abs, () => {});
  }
}

// Удаляет из uploads/tmp файлы, оставшиеся после аварийных остановок сервера (старше maxAgeMs)
function cleanTmp(maxAgeMs = 60 * 60 * 1000) {
  const dir = path.join(UPLOADS, 'tmp');
  let removed = 0;
  if (!fs.existsSync(dir)) return removed;
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    try {
      const st = fs.statSync(file);
      if (st.isFile() && Date.now() - st.mtimeMs > maxAgeMs) {
        fs.unlinkSync(file);
        removed++;
      }
    } catch (e) { /* файл мог исчезнуть */ }
  }
  return removed;
}

module.exports = { removeUploadedFile, cleanTmp, ROOT, UPLOADS };
