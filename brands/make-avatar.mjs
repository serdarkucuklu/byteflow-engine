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


/**
 * Etiket (asma kartela) silueti: üstü pahlı bir dikdörtgen + ip deliği.
 * Neden damla değil: damla sıvı demek — cilt bakımında doğru, giyimde yanlış. Sayfanın adı
 * @etiket.kodu ve tezi "etiketi oku"; simge de onu söylemeli. Aile kimliğini ORTADAKİ şekil
 * değil, dıştaki eşmerkezli halkalar taşıyor (kardeş sayfada da aynı halkalar var).
 *
 * `delik` true dönerse orası arka planla doldurulur (ipin geçtiği yer).
 */
function inTag(x, y, cx, cy, r) {
  const halfW = r * 1.02, halfH = r * 1.42;         // gövde
  const dx = Math.abs(x - cx), dy = y - cy;
  if (dx > halfW || dy > halfH || dy < -halfH) return false;
  // Üst iki köşe pahlı: kartelanın sivrilen ucu (45°).
  const pah = r * 0.62;
  if (dy < -halfH + pah && dx > halfW - pah) {
    if ((dx - (halfW - pah)) + ((-halfH + pah) - dy) > pah) return false;
  }
  return true;
}

/** İp deliği — etiketin üst kısmında, gövdeden oyulur. */
function inTagHole(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - (cy - r * 1.05)) <= r * 0.20;
}


/**
 * Soru işareti: üstte açık bir kanca (halka dilimi) + altta gövde + nokta.
 * Neden etiket değil: sayfa @kizlar.kodu ve tezi "her şeyin bir sebebi var" — simge bir ürünü
 * değil SORUYU göstermeli. Kardeş sayfalarla akrabalığı yine dıştaki eşmerkezli halkalar
 * taşıyor; ortadaki şekil her sayfada farklı (damla = cilt, soru = merak).
 */
function inQuestion(x, y, cx, cy, r) {
  const kancaCy = cy - r * 0.58, R = r * 0.66, kalinlik = r * 0.30;
  const dx = x - cx, dy = y - kancaCy;
  const d = Math.hypot(dx, dy);
  if (Math.abs(d - R) <= kalinlik / 2) {
    // Açı: y aşağı doğru arttığı için ekran koordinatında ölçülüyor.
    // Kanca ÜSTÜ tam kapsar, sol-altta açıklık bırakır (soru işaretinin boşluğu).
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;   // -180..180, 0 = sağ, -90 = yukarı
    if (ang <= 90 || ang >= 160) return true;
  }
  // Gövde: kancanın alt ucundan aşağı inen dikey çubuk.
  if (Math.abs(dx) <= kalinlik / 2 && y >= kancaCy + R - kalinlik / 2 && y <= cy + r * 0.42) return true;
  // Nokta.
  if (Math.hypot(dx, y - (cy + r * 0.92)) <= kalinlik * 0.58) return true;
  return false;
}

function render(brand) {
  const bg = hex(brand.palette?.bg ?? '#17110f');
  const c1 = hex(brand.themes?.[0] ?? '#e8a0a8');
  const c2 = hex(brand.themes?.[1] ?? '#c9a227');
  // Damla halkaların İÇİNDE kalmalı: ilk denemede uç kadrajın üstünden taştı ve iç halkayı kesti.
  // Marka `symbol` demezse damla — kardeş sayfanın (@cilt.kodu) görüntüsü değişmesin.
  const etiket = brand.symbol === 'etiket';
  const soru = brand.symbol === 'soru';
  const W = SIZE * SS, cx = W / 2, r = W * 0.118;
  // Damla siluetinin ağırlık merkezi altta; etiket simetrik, bu yüzden kadraja ortalanır.
  const cy = (etiket || soru) ? W * 0.5 : W * 0.605;
  const acc = new Float64Array(SIZE * SIZE * 3);

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let col = bg;
      const d = Math.hypot(x - cx, y - W / 2);
      const ringR = W * 0.395, ringW = W * 0.006;
      if (Math.abs(d - ringR) < ringW) col = mix(bg, c2, 0.55);                       // dış halka
      if (Math.abs(d - ringR * 0.86) < ringW * 0.6) col = mix(bg, c2, 0.28);          // ince iç halka
      if (soru) {
        if (inQuestion(x, y, cx, cy, r * 1.18)) {
          const t = Math.min(1, Math.max(0, (y - (cy - r * 1.5)) / (r * 3)));
          col = mix(c1, c2, t);                                                        // soru dolgusu
        }
      } else if (etiket) {
        if (inTag(x, y, cx, cy, r) && !inTagHole(x, y, cx, cy, r)) {
          const t = Math.min(1, Math.max(0, (y - (cy - r * 1.42)) / (r * 2.84)));
          col = mix(c1, c2, t);                                                        // etiket dolgusu
        } else if (inTag(x, y, cx, cy, r * 1.13) && !inTag(x, y, cx, cy, r * 1.05)) {
          col = mix(bg, c1, 0.45);                                                     // etiket konturu
        }
      } else if (inDroplet(x, y, cx, cy, r)) {
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
