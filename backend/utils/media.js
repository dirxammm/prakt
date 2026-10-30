// Генерация тестовых файлов без внешних программ: PNG-картинки и WAV-звук.
// Используется скриптами seed-demo (демо-данные) и smoke-test (автотесты).
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// PNG размером w×h; pixel(x, y) возвращает [r, g, b]
function makePng(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      raw[p++] = r; raw[p++] = g; raw[p++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));

// Простые «пейзажи»: градиент неба, светило и силуэт горизонта
function scenePng(scene, w = 800, h = 500) {
  const { top, bottom, sun, sunColor, ground, wave } = scene;
  return makePng(w, h, (x, y) => {
    const t = y / h;
    let c = mix(top, bottom, Math.min(1, t * 1.2));
    if (sun) {
      const dx = x - sun[0] * w, dy = y - sun[1] * h, r = sun[2] * h;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < r) c = sunColor;
      else if (d < r * 1.6) c = mix(c, sunColor, 0.25 * (1 - (d - r) / (r * 0.6)));
    }
    const horizon = h * (ground ? ground.level : 0.72) + (wave ? Math.sin(x / wave.len) * wave.amp : 0) +
      (ground && ground.peaks ? Math.abs(Math.sin(x / ground.peaks)) * -h * 0.18 : 0);
    if (y > horizon) c = ground ? mix(ground.color, [0, 0, 0], (y - horizon) / h * 0.5) : c;
    return c;
  });
}

// WAV 16 бит, моно: тон с плавным началом и затуханием
function makeWav({ freq = 440, seconds = 3, rate = 22050, overtone = 0.3 } = {}) {
  const n = Math.floor(rate * seconds);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.min(1, t / 0.05) * Math.min(1, (seconds - t) / 0.3);
    const v = (Math.sin(2 * Math.PI * freq * t) + overtone * Math.sin(2 * Math.PI * freq * 2 * t)) / (1 + overtone);
    data.writeInt16LE(Math.round(v * env * 0.5 * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write('RIFF', 0); head.writeUInt32LE(36 + data.length, 4); head.write('WAVE', 8);
  head.write('fmt ', 12); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(1, 22);
  head.writeUInt32LE(rate, 24); head.writeUInt32LE(rate * 2, 28); head.writeUInt16LE(2, 32); head.writeUInt16LE(16, 34);
  head.write('data', 36); head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

module.exports = { makePng, scenePng, makeWav };
