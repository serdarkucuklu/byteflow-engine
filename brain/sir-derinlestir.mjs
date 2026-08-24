// Faz 1 (docs/plan/cilt-insider-sirlar.md) — spec kapısını geçtikten SONRA koşan, sabit turlu
// bir derinleştirme döngüsü. Puan/eşik YOK: turSayisi kadar tur koşar, SON turu (en derini) döner.
// generateSpec/produceSpec'e dokunulmuyor; fetch sözleşmesi generate-spec.mjs'teki generateSpec()
// ile aynı (contents[0].parts[0].text gönder, candidates[0].content.parts[0].text'ten JSON al).
import {fileURLToPath} from 'node:url';
import {MODELS} from './generate-spec.mjs';

const ENDPOINT = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

function secretPrompt({konu, pillar, brand = {}, brief, previous}) {
  const domain = brand.examples?.domain ?? pillar.focus;
  const namedExamples = brand.namedExamples ?? pillar.focus;
  const lang = brand.language ?? 'en';

  const briefBlock = brief ? `
VİDEONUN AÇILIŞI VE KAPANIŞI DONMUŞ — DEĞİŞTİRİLEMEZ, sen onları yazmıyorsun:
Açılış: "${brief.acilis}"
Kapanış: "${brief.kapanis}"
${brief.status?.length ? `Kapanış kartı satırları (bunlar da donmuş): ${brief.status.map(s => `"${s}"`).join(', ')}` : ''}
Bulacağın mekanizma detayı bu ikisinin ARASINDAKİ cümleleri dolduracak. Açılış ve kapanışla
ÇELİŞMEYEN, ikisiyle aynı hikâyeyi anlatan bir mekanizma detayı bul.
` : '';

  const previousBlock = previous ? `
ÖNCEKİ TUR: "${previous.sir}"
Bu bilgiye ulaşmak için önerilen arama: "${previous.googleSorgu}" — yani bu bilgi "${previous.googleSorgu}"
araması yapılınca 10 saniyede bulunur, sıradan bilgidir. Bir mekanizma katmanı daha in: önceki
turdan daha derin, daha az bilinen, daha spesifik bir detay bul. Aynısını tekrarlama.
` : '';

  return `Sen "${konu}" konusunda ${domain} alanında uzman bir araştırmacısın.
Konu evreni: ${domain}. Bu evrendeki bilinen örnekler: ${namedExamples}.
Bugünkü içerik sütunu (pillar) "${pillar.key}": ${pillar.focus}.
${briefBlock}${previousBlock}
Görev: "${konu}" hakkında ortalama bir kullanıcının BİLMEDİĞİ, "insider" bir mekanizma detayı
bul — genel geçer bir tanım değil, ${domain} alanında gerçekten az bilinen bir gerçek ya da
mekanizma. Detay "${pillar.focus}" kapsamının İÇİNDE ve ${domain} evreninin İÇİNDE kalmalı;
konu evreninin dışına ASLA çıkma.

Sayı uydurma, kapalı bir ürünün içini bildiğini iddia etme — yalnız kamuya açık/gözlemlenebilir
mekanizmaları ya da ders kitabı düzeyinde sağlam bilgiyi anlat.

SADECE şu JSON'u döndür, başka metin yazma:
{"sir": "<mekanizma detayı, 1-2 cümle, ${lang} dilinde>", "neden": "<bunun neden insider/az bilinen olduğu, 1 cümle, ${lang} dilinde>", "googleSorgu": "<bu bilgiye ulaşmak için birinin google'a yazacağı arama sorgusu>"}`;
}

async function callGemini({apiKey, prompt, fetchFn}) {
  try {
    const res = await fetchFn(ENDPOINT(apiKey, MODELS[0]), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        contents: [{parts: [{text: prompt}]}],
        generationConfig: {responseMimeType: 'application/json', temperature: 0.9},
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const obj = JSON.parse(text);
    if (!obj?.sir || !obj?.googleSorgu) return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * Sabit turlu insider-sır derinleştirme döngüsü. Puan/eşik yok: turSayisi kadar tur koşar,
 * SON (en derin) turu döner. Bütçe aşılırsa eldeki son tur döner. Üst üste 2 fetch hatasında
 * null döner (throw etmez). bilinenSirlar Faz 2'de sir-defteri.mjs bağlandığında kullanılacak.
 */
export async function sirBul({konu, pillar, brief = null, apiKey, brand = {}, bilinenSirlar = [],
  turSayisi = 2, butceMs = 40000, fetchFn = fetch}) {
  const start = Date.now();
  let lastGood = null;
  let ardArdaHata = 0;

  for (let tur = 1; tur <= turSayisi; tur++) {
    if (tur > 1 && Date.now() - start >= butceMs) break;

    const prompt = secretPrompt({konu, pillar, brand, brief, previous: lastGood});
    const sonuc = await callGemini({apiKey, prompt, fetchFn});

    if (!sonuc) {
      ardArdaHata++;
      console.log(`[sir] tur ${tur}: hata`);
      if (ardArdaHata >= 2) return null;
      continue;
    }

    ardArdaHata = 0;
    lastGood = {konu, sir: sonuc.sir, neden: sonuc.neden, googleSorgu: sonuc.googleSorgu, tur};
    console.log(`[sir] tur ${tur}: ${sonuc.sir}`);
  }

  return lastGood;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {loadBrand} = await import('../brands/load.mjs');
  const {pillarsFor} = await import('./pillars.mjs');

  const argv = process.argv;
  const arg = name => argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const konu = arg('konu');
  const yaz = argv.includes('--yaz');

  if (!konu) {
    console.error('kullanım: node brain/sir-derinlestir.mjs --brand=<slug> --konu=<konu> [--yaz]');
    process.exit(1);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY eksik (.env)');
    process.exit(1);
  }

  const brand = loadBrand();
  const pillar = pillarsFor(brand.pillarSet)[0];
  const cfg = brand.sirDerinlestirme ?? {};

  const sonuc = await sirBul({
    konu,
    pillar,
    apiKey,
    brand,
    turSayisi: cfg.turSayisi ?? 2,
    butceMs: (cfg.butceSn ?? 40) * 1000,
  });

  console.log(JSON.stringify(sonuc, null, 2));
  if (yaz) console.log('[sir] --yaz: sir-defteri.mjs henüz yok (Faz 2), yazılmadı.');
  process.exit(sonuc ? 0 : 1);
}
