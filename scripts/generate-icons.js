// Rasterise le logo (une barre chargée, inclinée) en PNG, sans dépendance.
//
// node scripts/generate-icons.js  -- réécrit les icônes et l'écran de
// démarrage dans assets/. Le dessin est dans SHAPES ; les couleurs sont
// celles de tailwind.config.js.
const fs = require('fs');
const zlib = require('zlib');

const LIME = [0xbf, 0xf0, 0x4a];
const DARK = [0x0e, 0x0f, 0x0d];
const WHITE = [0xff, 0xff, 0xff];

// Le dessin, centré sur l'origine, en unités d'une toile de 1024.
const SHAPES = [
  { cx: 0, cy: 0, w: 780, h: 56, r: 28 }, // la barre
  { cx: -205, cy: 0, w: 88, h: 400, r: 28 }, // disques intérieurs
  { cx: 205, cy: 0, w: 88, h: 400, r: 28 },
  { cx: -305, cy: 0, w: 66, h: 280, r: 24 }, // disques extérieurs
  { cx: 305, cy: 0, w: 66, h: 280, r: 24 },
];
const ANGLE = (-32 * Math.PI) / 180;
const COS = Math.cos(-ANGLE);
const SIN = Math.sin(-ANGLE);

function inside(x, y) {
  // Ramener le point dans le repère du dessin, avant rotation.
  const px = x * COS - y * SIN;
  const py = x * SIN + y * COS;
  for (const s of SHAPES) {
    const qx = Math.abs(px - s.cx) - s.w / 2 + s.r;
    const qy = Math.abs(py - s.cy) - s.h / 2 + s.r;
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - s.r;
    if (outside <= 0) return true;
  }
  return false;
}

/** `scale` : pixels par unité de dessin. `bg` absent : fond transparent. */
function render(size, { scale, fg, bg }) {
  const SS = 4;
  const data = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let hits = 0;
      for (let a = 0; a < SS; a++) {
        for (let b = 0; b < SS; b++) {
          const x = (i + (a + 0.5) / SS - size / 2) / scale;
          const y = (j + (b + 0.5) / SS - size / 2) / scale;
          if (inside(x, y)) hits++;
        }
      }
      const c = hits / (SS * SS);
      const o = (j * size + i) * 4;
      if (bg) {
        for (let k = 0; k < 3; k++) data[o + k] = Math.round(bg[k] * (1 - c) + fg[k] * c);
        data[o + 3] = 255;
      } else {
        for (let k = 0; k < 3; k++) data[o + k] = fg[k];
        data[o + 3] = Math.round(255 * c);
      }
    }
  }
  return png(size, data);
}

function solid(size, color) {
  const data = Buffer.alloc(size * size * 4);
  for (let p = 0; p < size * size; p++) data.set([...color, 255], p * 4);
  return png(size, data);
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
}
function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // profondeur
  header[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let j = 0; j < size; j++) rgba.copy(raw, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = process.argv[2] ?? 'assets';
// Le dessin, une fois incliné, occupe environ 850 unités de large.
const fit = (size, share) => (size * share) / 850;
fs.writeFileSync(`${out}/icon.png`, render(1024, { scale: fit(1024, 0.72), fg: LIME, bg: DARK }));
fs.writeFileSync(`${out}/splash-icon.png`, render(1024, { scale: fit(1024, 0.9), fg: LIME }));
fs.writeFileSync(`${out}/android-icon-background.png`, solid(512, DARK));
// Zone sûre d'une icône adaptative : le disque central de 66 %.
fs.writeFileSync(`${out}/android-icon-foreground.png`, render(512, { scale: fit(512, 0.58), fg: LIME }));
fs.writeFileSync(`${out}/android-icon-monochrome.png`, render(432, { scale: fit(432, 0.58), fg: WHITE }));
fs.writeFileSync(`${out}/favicon.png`, render(48, { scale: fit(48, 0.8), fg: LIME, bg: DARK }));
