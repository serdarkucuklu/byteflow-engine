// Dry-run: brain/produce-spec.mjs'i GERÇEK Gemini çağrısıyla çalıştırır (retry/repair dahil),
// ama dosya YAZMAZ, render/TTS YOK — sadece spec'i ekrana basar ve iki sert kapıdan geçirir.
//
// `docs/plan/kizlarkodu-erkek-gaf.md` Faz 1: --twist ZORUNLU (twist'siz koşu üretimden farklı
// prompt ölçer — run-daily.mjs her zaman twist zorluyor, bu script de zorlamalı).
//
// Kullanım:
//   node --env-file=.env brain/dene-spec.mjs --brand=kizlarkodu --pillar=kurutma-ve-utu --twist=erkek-dolabi
import {loadBrand} from '../brands/load.mjs';
import {pillarsFor} from './pillars.mjs';
import {twistsFor, twistByKey} from './twists.mjs';
import {produceSpec} from './produce-spec.mjs';

function arg(name) {
  const pre = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(pre));
  return found ? found.slice(pre.length) : null;
}

const brandArg = arg('brand');
const pillarKey = arg('pillar');
const twistKey = arg('twist');

// 1.5: --twist ZORUNLU. Twist'siz koşu run-daily.mjs'in gerçek davranışını (her zaman twist
// zorlar) ölçmez — sessizce twist'siz bir prompt "geçti" der, yalan yeşil verir.
if (!twistKey) {
  console.error('kullanım: node --env-file=.env brain/dene-spec.mjs --brand=<slug> --pillar=<key> --twist=<key>');
  console.error('  --twist ZORUNLU (twist olmadan koşu üretimden farklı bir prompt ölçer).');
  process.exit(2);
}
if (!pillarKey) {
  console.error('kullanım: node --env-file=.env brain/dene-spec.mjs --brand=<slug> --pillar=<key> --twist=<key>');
  process.exit(2);
}

const brand = loadBrand(brandArg ?? undefined);
const PILLARS = pillarsFor(brand.pillarSet);
const pillar = PILLARS.find(p => p.key === pillarKey);
if (!pillar) {
  console.error(`bilinmeyen pillar: ${pillarKey} (${PILLARS.map(p => p.key).join(', ')})`);
  process.exit(2);
}

const TWISTS = twistsFor(brand.twistSet);
const twist = twistByKey(twistKey, TWISTS); // bilinmeyen anahtarda kendi throw'u var (sessiz fallback yasak)

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY yok — .env dosyasını `--env-file=.env` ile yükle.');
  process.exit(2);
}

console.log(`▣ marka: ${brand.slug} · pillar: ${pillar.key} · twist: ${twist.key}`);

const {spec, source} = await produceSpec({candidates: [], apiKey, pillar, brand, twist});

console.log(`kaynak: ${source}`);

// 1.6(a): SEED FALLBACK gerçek üretim değildir — kumaş temalı seed döner ve yalan yeşil verir
// (bkz. brain/produce-spec.mjs:64-70).
if (source !== 'gemini') {
  console.error('✗ SEED FALLBACK — Gemini gerçek üretim yapmadı, dry-run kapısı geçersiz');
  process.exit(1);
}

console.log(`title: ${spec.title}`);
console.log(`hook: ${spec.hook}`);
console.log(`subject: ${spec.subject}`);
console.log(`sendTo: ${spec.sendTo}`);
console.log('step.status:');
const nodeLabels = [];
const stepStatuses = [];
// versus sahnesinin (generate-spec.mjs:66-70) kendi alanları var: nodes/steps YOK.
const versusMetinleri = [];
for (const scene of spec.scenes ?? []) {
  for (const node of scene.nodes ?? []) nodeLabels.push(node.label ?? '');
  for (const step of scene.steps ?? []) {
    stepStatuses.push(step.status ?? '');
    console.log(`  - ${step.status}`);
  }
  if (scene.heading) versusMetinleri.push({alan: 'scene.heading', metin: scene.heading});
  if (scene.left) versusMetinleri.push({alan: 'scene.left', metin: scene.left});
  if (scene.right) versusMetinleri.push({alan: 'scene.right', metin: scene.right});
  for (const row of scene.rows ?? []) {
    if (row.label) versusMetinleri.push({alan: 'scene.rows[].label', metin: row.label});
    if (row.left) versusMetinleri.push({alan: 'scene.rows[].left', metin: row.left});
    if (row.right) versusMetinleri.push({alan: 'scene.rows[].right', metin: row.right});
  }
}
console.log('narration:');
for (const line of spec.narration ?? []) console.log(`  - ${line}`);
console.log(`caption: ${spec.caption}`);

// 1.6(b): SIZINTI taraması. Kişi kelimeleri node label / step.status / narration / versus
// alanları / title'da YASAK — hook, sendTo, caption CTA'da kişi SERBEST
// (generate-spec.mjs:231-236 HARD RULE: "EXACTLY three places ... NOWHERE ELSE").
//
// Kök + BİLİNEN Türkçe ek(ler) eşleşir ("adamın", "kocası", "kardeşine", "erkeklerin",
// "adamlar" YAKALANIR), ama kökten sonra BİLİNMEYEN harflerle devam eden başka bir kelime
// eşleşmez ("sabit/kabin/abiye"deki abi, "kocaman"daki koca, "adamakıllı"daki adam YANLIŞ
// kırmızı üretmez — soldaki lookbehind zaten "sabit/kabin"i harf bitişikliğinden eler, sağdaki
// ek listesi de "kocaman/adamakıllı/abiye"yi eler). REVİZYON: eski sağ lookahead HER ekli hâli
// (gerçek sızıntıyı) de reddediyordu — bkz. gözden-gecirici bulgusu 2026-08-23.
const TR_HARF = 'a-zA-ZçğıöşüÇĞİÖŞÜ';
const BILINEN_EKLER = 'ı|i|u|ü|a|e|ın|in|un|ün|lar|ler|ları|leri|ların|lerin|sı|si|su|sü|sına|sine|' +
  'ına|ine|dan|den|tan|ten|da|de|ta|te|la|le|yla|yle|ıyla|iyle|';
const SIZINTI_DESENI = new RegExp(
  `(?<![${TR_HARF}])(erkek|adam|koca|kardeş|abi)(?:${BILINEN_EKLER})(?![${TR_HARF}])`, 'i');

const sizinti = [];
for (const l of nodeLabels) if (SIZINTI_DESENI.test(l)) sizinti.push(`node label: "${l}"`);
for (const s of stepStatuses) if (SIZINTI_DESENI.test(s)) sizinti.push(`step.status: "${s}"`);
for (const n of spec.narration ?? []) if (SIZINTI_DESENI.test(n)) sizinti.push(`narration: "${n}"`);
for (const {alan, metin} of versusMetinleri) if (SIZINTI_DESENI.test(metin)) sizinti.push(`${alan}: "${metin}"`);
if (spec.title && SIZINTI_DESENI.test(spec.title)) sizinti.push(`title: "${spec.title}"`);

if (sizinti.length) {
  console.error('✗ SIZINTI — kişi mekanizma alanına sızmış (node label / step.status / narration):');
  for (const s of sizinti) console.error(`  ${s}`);
  process.exit(1);
}

console.log('✓ SIZINTI YOK · kaynak: gemini');
