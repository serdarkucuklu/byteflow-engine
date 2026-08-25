// Faz 3 (docs/plan/cilt-insider-sirlar.md) — yapı-koruyan enjeksiyon, brain/localize.mjs
// deseninin birebir izlediği yol: dar kapsam, yapıyı JS'te zorla koru, başarısızlıkta girdiyi
// aynen döndür. generate-spec.mjs/produce-spec.mjs'e dokunulmuyor; enjeksiyon onlardan SONRA
// koşar ve kendi validateSpec kapısını kurar.
//
// Yeniden yazım yüzeyi TAM OLARAK üç alan: narration[1..son-1], scenes[].steps[].status, caption.
// hook/narration[0]/narration[son]/takeaway/subject/nodes/adım from-to-packet-color DONMUŞ.
import {MODELS} from './generate-spec.mjs';
import {validateSpec} from './validate.mjs';
import {looksLocalized} from './localize.mjs';
import {subjectTokens, tokensClash} from './subjects.mjs';

const ENDPOINT = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

function enjektePrompt({spec, sir, brand}) {
  const persona = brand.persona ?? {};
  const tone = brand.tone ?? {};
  const vid = brand.video ?? {};
  const lang = brand.language ?? 'en';
  const bodySentences = spec.narration.slice(1, -1);
  const stepsFlat = (spec.scenes ?? []).flatMap(s => s.steps ?? []);

  return `Sen "${persona.name ?? 'marka'}" için içerik editörüsün. Aşağıdaki video spec'inin
GÖVDESİNE, tam olarak ÜÇ alana, bir "insider sır" mekanizma detayı işleyeceksin.

DONMUŞ, DEĞİŞTİRİLEMEZ (çıktında AYNEN geri ver, tek karakter dokunma):
- narration[0] (açılış): "${spec.narration[0]}"
- narration[${spec.narration.length - 1}] (kapanış): "${spec.narration.at(-1)}"
- hook: "${spec.hook}"
- takeaway: "${spec.takeaway}"

DEĞİŞTİRECEĞİN ÜÇ ALAN:
1. narration[1..${spec.narration.length - 2}] — gövde cümleleri, şu an:
   ${JSON.stringify(bodySentences)}
   Her cümle ${vid.minWords ?? 5}-${vid.maxWords ?? 9} kelime olmalı (bu bir ARALIK, yalnız tavan değil).
2. Her adımın "status" metni (kapanış kartında görünen satır), şu an:
   ${JSON.stringify(stepsFlat.map(s => s.status))}
   Her biri en fazla 40 karakter, sırla ilgili yeni bilgiyi taşımalı.
3. caption, şu an:
   ${JSON.stringify(spec.caption)}
   Şu satırları AYNEN koru: "${persona.byline ?? ''}", "${persona.tagline ?? ''}", "${spec.soru ?? ''}".
   Yalnız açıklama kısmını sırla zenginleştir.

TON KURALI (birebir uygula): ${tone.bodyRule ?? ''}

SIR: "${sir.sir}"
(neden az bilinir: ${sir.neden ?? ''})

ÇELİŞKİ KURALI: sır mevcut özneye/adımlara/gaf eksenine sığmıyorsa alanları AYNEN geri ver
(değiştirme, orijinal metni tekrarla).

Sayı uydurma, kapalı bir ürünün içini bildiğini iddia etme. Tüm çıktı ${lang} dilinde olmalı.

SADECE şu JSON'u döndür, başka metin yazma. narration TAM ${spec.narration.length} eleman
taşımalı (uçlar dahil), scenes[].steps her sahne için ORİJİNAL adım sayısıyla TAM step
objelerini (from/to/packet/color/status) taşımalı:
{"narration": [...], "scenes": [{"steps": [{"from": "...", "to": "...", "packet": "...", "color": "...", "status": "..."}]}], "caption": "..."}`;
}

async function callGemini({apiKey, prompt, fetchFn, retries}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const model = MODELS[Math.min(attempt, MODELS.length - 1)];
    try {
      const res = await fetchFn(ENDPOINT(apiKey, model), {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          contents: [{parts: [{text: prompt}]}],
          generationConfig: {responseMimeType: 'application/json', temperature: 0.7},
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('boş yanıt');
      return JSON.parse(text);
    } catch (e) {
      console.error(`[sir-enjekte] deneme ${attempt} (${model}): ${e.message}`);
    }
  }
  return null;
}

function wordCount(s) {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}

function narrationGateOk(newNarration, spec, vid) {
  if (!Array.isArray(newNarration) || newNarration.length !== spec.narration.length) return false;
  if (newNarration[0] !== spec.narration[0]) return false;
  const last = newNarration.length - 1;
  if (newNarration[last] !== spec.narration[last]) return false;
  const minWords = vid.minWords ?? 5;
  const maxWords = vid.maxWords ?? 9;
  for (let i = 1; i < last; i++) {
    const s = newNarration[i];
    if (typeof s !== 'string' || !s.trim()) return false;
    const words = wordCount(s);
    if (words < minWords || words > maxWords) return false;
  }
  return true;
}

function stepsGateOk(newScenes, origScenes) {
  if (!Array.isArray(newScenes) || newScenes.length !== origScenes.length) return false;
  for (let i = 0; i < origScenes.length; i++) {
    const origSteps = origScenes[i].steps ?? [];
    const newSteps = newScenes[i]?.steps;
    if (!Array.isArray(newSteps) || newSteps.length !== origSteps.length) return false;
    for (let j = 0; j < origSteps.length; j++) {
      const o = origSteps[j];
      const n = newSteps[j];
      if (!n) return false;
      if (n.from !== o.from || n.to !== o.to || n.packet !== o.packet || n.color !== o.color) return false;
      if (typeof n.status !== 'string' || !n.status.trim() || n.status.length > 40) return false;
    }
  }
  return true;
}

function captionGateOk(newCaption, spec, brand) {
  if (typeof newCaption !== 'string' || !newCaption.trim()) return false;
  const persona = brand.persona ?? {};
  if (persona.byline && !newCaption.includes(persona.byline)) return false;
  if (persona.tagline && !newCaption.includes(persona.tagline)) return false;
  if (spec.soru && !newCaption.includes(spec.soru)) return false;
  return true;
}

/**
 * Sırrı spec'in gövdesine (narration[1..son-1], steps[].status, caption) yapı-koruyan bir
 * yeniden yazımla işler. hook/narration uçları/takeaway/subject/nodes/adım from-to-packet-color
 * DONMUŞ. Alan bazlı JS kapıları + dil kapısı (looksLocalized, yalnız değişen içerik) + K2
 * sözlüksel iz kapısı (özne düşülmüş sır tokenları gövde+status'ta geçmeli) + son validateSpec.
 * Herhangi bir global kapı başarısızsa TÜM enjeksiyon geri alınır. Girdi spec mutasyona uğramaz.
 */
export async function enjekteEt({spec, sir, brand, apiKey, fetchFn = fetch, retries = 1}) {
  const prompt = enjektePrompt({spec, sir, brand});
  const parsed = await callGemini({apiKey, prompt, fetchFn, retries});
  if (!parsed) {
    return {spec, uygulandi: 'geri-alindi', sebep: 'istek-basarisiz'};
  }

  const vid = brand.video ?? {};
  const origScenes = spec.scenes ?? [];

  const narrationOk = narrationGateOk(parsed.narration, spec, vid);
  const candidateNarration = narrationOk ? parsed.narration : spec.narration;

  const stepsOk = stepsGateOk(parsed.scenes, origScenes);
  const candidateScenes = stepsOk
    ? origScenes.map((scene, i) => ({
      ...scene,
      steps: (scene.steps ?? []).map((step, j) => ({...step, status: parsed.scenes[i].steps[j].status})),
    }))
    : origScenes;

  const captionOk = captionGateOk(parsed.caption, spec, brand);
  const candidateCaption = captionOk ? parsed.caption : spec.caption;

  const changedBody = narrationOk
    ? candidateNarration.slice(1, -1).filter((s, i) => s !== spec.narration[i + 1])
    : [];
  const changedStatuses = stepsOk
    ? candidateScenes.flatMap((scene, i) => scene.steps
      .filter((st, j) => st.status !== origScenes[i].steps[j]?.status)
      .map(st => st.status))
    : [];
  const changedCaption = captionOk && candidateCaption !== spec.caption ? candidateCaption : null;

  const changedAll = [...changedBody, ...changedStatuses, ...(changedCaption ? [changedCaption] : [])];
  if (!changedAll.length) {
    return {spec, uygulandi: 'geri-alindi', sebep: 'degisiklik-yok'};
  }

  if (!looksLocalized({narration: changedAll}, brand.language)) {
    return {spec, uygulandi: 'geri-alindi', sebep: 'dil-gecersiz'};
  }

  // K2 — sözlüksel iz: sır tokenlarından ÖZNENİN tokenlarını düş, kalan (varsa) gövde+status'ta
  // geçmeli. subjectsClash burada KULLANILMAZ — özne her iki tarafta da geçtiği için hep true
  // dönerdi (bkz. plan Tuzaklar, subjects.mjs:26-31,48-52).
  const subjTokens = subjectTokens(spec.subject);
  const ayirtEdici = subjectTokens(sir.sir).filter(t => !subjTokens.some(k => tokensClash(k, t)));
  if (!ayirtEdici.length) {
    return {spec, uygulandi: 'geri-alindi', sebep: 'iz-yok'};
  }
  const govdeMetni = [
    ...(narrationOk ? candidateNarration.slice(1, -1) : []),
    ...(stepsOk ? candidateScenes.flatMap(s => s.steps.map(st => st.status)) : []),
  ].join(' ');
  const govdeTokens = subjectTokens(govdeMetni);
  const izVar = ayirtEdici.some(t => govdeTokens.some(g => tokensClash(t, g)));
  if (!izVar) {
    return {spec, uygulandi: 'geri-alindi', sebep: 'iz-yok'};
  }

  const finalSpec = {...spec, narration: candidateNarration, scenes: candidateScenes, caption: candidateCaption};
  const {valid} = validateSpec(finalSpec);
  if (!valid) {
    return {spec, uygulandi: 'geri-alindi', sebep: 'spec-gecersiz'};
  }

  const appliedCount = [changedBody.length > 0, changedStatuses.length > 0, changedCaption !== null]
    .filter(Boolean).length;
  const uygulandi = appliedCount === 3 ? 'tam' : appliedCount === 0 ? 'geri-alindi' : 'kismi';

  return {spec: finalSpec, uygulandi, sebep: null};
}
