// Marka avatarı üretici — profil fotoğrafını dışarıya bağımlı olmadan çizer.
//
// Neden elle raster: Gemini görsel kotası dolduğunda (ya da anahtar yokken) profil fotoğrafı
// üretilemez hâle geliyordu; ffmpeg build'imizde drawtext yok, sistemde SVG dönüştürücü yok.
// Node'un zlib'iyle PNG yazmak hem deterministik hem bağımsız: aynı marka → aynı avatar.
//
// Kullanım: node brands/make-avatar.mjs <slug> [çıktı.png]
import {deflateSync} from 'node:zlib';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadBrand} from './load.mjs';

const SIZE = 1080, SS = 2;                     // SS: kenar yumuşatma için süper-örnekleme

const hex = h => {
  const v = h.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const mix = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t));

/**
 * Damla silueti: altta yarım daire, üstte YUMUŞAK daralan uç.
 * Genişlik cos(t·π/2)^0.75 ile daralıyor — türevi birleşme noktasında sıfır olduğu için
 * daire ile uç arasında çentik oluşmuyor (ilk denemede iki yanda görünür kırık vardı).
 */
function inDroplet(x, y, cx, cy, r) {
  const tipY = cy - r * 2.5;
  if (y < tipY) return false;   // ucun ÜSTÜ: t=1'e kırpılınca merkez sütunu boyunca
                                // 1 piksellik çizgi kadrajın tepesine kadar uzuyordu
  if (y >= cy) return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;      // alt yarım daire
  const t = (cy - y) / (cy - tipY);                                 // 0 (merkez) → 1 (uç)
  const half = r * Math.pow(Math.cos(t * Math.PI / 2), 0.75);
  return Math.abs(x - cx) <= half;
}

function render(brand) {
  const bg = hex(brand.palette?.bg ?? '#17110f');
  const c1 = hex(brand.themes?.[0] ?? '#e8a0a8');
  const c2 = hex(brand.themes?.[1] ?? '#c9a227');
  // Damla halkaların İÇİNDE kalmalı: ilk denemede uç kadrajın üstünden taştı ve iç halkayı kesti.
  const W = SIZE * SS, cx = W / 2, cy = W * 0.605, r = W * 0.118;
  const acc = new Float64Array(SIZE * SIZE * 3);

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let col = bg;
      const d = Math.hypot(x - cx, y - W / 2);
      const ringR = W * 0.395, ringW = W * 0.006;
      if (Math.abs(d - ringR) < ringW) col = mix(bg, c2, 0.55);                       // dış halka
      if (Math.abs(d - ringR * 0.86) < ringW * 0.6) col = mix(bg, c2, 0.28);          // ince iç halka
      if (inDroplet(x, y, cx, cy, r)) {
        const t = Math.min(1, Math.max(0, (y - (cy - r * 2.5)) / (r * 3.5)));
        col = mix(c1, c2, t);                                                          // damla dolgusu
      } else if (inDroplet(x, y, cx, cy, r * 1.14) && !inDroplet(x, y, cx, cy, r * 1.06)) {
        col = mix(bg, c1, 0.45);                                                       // damla konturu
      }
      const px = ((y / SS) | 0) * SIZE + ((x / SS) | 0);
      acc[px * 3] += col[0]; acc[px * 3 + 1] += col[1]; acc[px * 3 + 2] += col[2];
    }
  }

  const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
  const n = SS * SS;
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 3 + 1)] = 0;                                   // filtre baytı
    for (let x = 0; x < SIZE; x++) {
      const p = (y * SIZE + x) * 3, o = y * (SIZE * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(acc[p] / n);
      raw[o + 1] = Math.round(acc[p + 1] / n);
      raw[o + 2] = Math.round(acc[p + 2] / n);
    }
  }
  return raw;
}

const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

export function makeAvatar(slug, outPath) {
  const brand = loadBrand(slug);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; ihdr[9] = 2;                                        // 8-bit, truecolor RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(brand), {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(outPath, png);
  return outPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2] ?? 'ciltkodu';
  const out = process.argv[3] ?? fileURLToPath(new URL(`./assets/${slug}-profile.png`, import.meta.url));
  console.log('✓', makeAvatar(slug, out));
}
