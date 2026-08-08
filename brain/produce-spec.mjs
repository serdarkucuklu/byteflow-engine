import {readFileSync} from 'node:fs';
import {validateSpec} from './validate.mjs';
import {generateSpec, MODELS} from './generate-spec.mjs';
import {repairSpec} from './repair.mjs';
import {clashingSubject} from './subjects.mjs';

export const SEED_BACKLOG = JSON.parse(
  readFileSync(new URL('./seed-backlog.json', import.meta.url)),
);

// Ürün/model adı taşıyan seed başlıkları (isimli konu = daha çok izlenme).
const NAMED = /claude|chatgpt|gpt|gemini|grok|copilot|cursor|mcp/i;

function pickSeedDefault(seeds) {
  // Deterministic default: always pick the first seed. Callers that want real
  // randomness (e.g. run-daily.mjs's CLI flow) inject their own pickSeed.
  return seeds[0];
}

// retries=4: 2026-07-27'de Gemini düşünce video seed'e düştü ve markasız/jenerik bir konu
// yayınlandı (Serdar beğenmedi, IG'den sildi). Seed düşüşü İSTİSNA olmalı — bir 429/503 dalgası
// yayını off-strateji bir konuya çevirmesin diye deneme sayısı artırıldı.
export async function produceSpec({candidates, apiKey, recentTitles = [], pillar, brand = {}, seeds = SEED_BACKLOG, generate = generateSpec, retries = 4, pickSeed = pickSeedDefault, backoffMs = 400,
  bannedSubjects = [], twist = null, bannedLayouts = [], recentKinds = [], not = null}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Deneme başına model merdiveninde bir basamak in (503/kapasite dalgasını aş).
      const model = MODELS[Math.min(attempt, MODELS.length - 1)];
      // ⚠ brand'i GEÇMEYİ UNUTMA. 2026-07-28: burada eksikti ve generateSpec her koşuda
      // brand={} ile çalıştı → varsayılan AI personası, "@byteflowlabs" tagline'ı ve
      // "Claude Code/GPT-5.2" örnekleri. localizeSpec sonradan Türkçeye çevirdiği için
      // @cilt.kodu'ya TÜRKÇE AI içeriği ("Claude Code vs Cursor") yayınlandı — marka
      // dosyası doğru olduğu hâlde. Marka yalnızca bu satırdan modele ulaşıyor.
      const raw = await generate({candidates, apiKey, recentTitles, pillar, brand, model,
        bannedSubjects, twist, bannedLayouts, recentKinds, not});
      // Küçük kusurları (kodsuz kod sahnesi, taşan label/packet) onar — denemeyi harcamak
      // yerine düzelt; her başarısız deneme bizi seed'e (jenerik videoya) yaklaştırıyor.
      const spec = repairSpec(raw, {defaultHashtags: brand.defaultHashtags, maxSteps: brand.video?.maxSteps, format: brand.format});
      const {valid, errors} = validateSpec(spec);
      if (valid) {
        // KONU TEKRARI = GEÇERSİZ ÜRETİM. Prompt'taki soğuma kuralı yumuşak bir istek;
        // burası sert kapı. 2026-08-01 Serdar direktifi: aynı etken madde arka arkaya
        // ASLA çıkmayacak — model kuralı çiğnerse denemeyi harcayıp yeniden üretiyoruz.
        const clash = clashingSubject(spec.subject ?? spec.title, bannedSubjects);
        if (!clash) return {spec, source: 'gemini'};
        console.error(`[produce] attempt ${attempt} KONU TEKRARI: "${spec.subject ?? spec.title}" ~ yasaklı "${clash}" → yeniden`);
      } else {
        console.error(`[produce] attempt ${attempt} (${MODELS[Math.min(attempt, MODELS.length - 1)]}) invalid: ${errors.join('; ')}`);
      }
    } catch (e) {
      console.error(`[produce] attempt ${attempt} error: ${e.message}`);
    }
    if (attempt < retries) await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
  }
  // NOT VARSA SEED YASAK. Serdar "şunu değiştir" diye not yazdıysa, havuzdan rastgele bir
  // yedek video onun notuyla hiç ilgilenmez — "tekrar dene"ye alakasız bir video dönmesi
  // sistemin güvenilirliğini bitirir. Hata dönüp konsolda görünmek daha dürüst.
  if (not) throw new Error(`not uygulanamadı: Gemini ${retries + 1} denemede spec üretemedi`);
  // Seed fallback: son yayınlanan konuları havuzdan çıkar (tekrar olmasın) ve ürün ADI
  // geçen seed'leri tercih et — isimli videolar bu hesapta ölçülebilir şekilde daha çok
  // izleniyor, jenerik seed'ler ise flop ediyor (2026-07-27 deneyimi).
  // Seed'e düşerken de konu soğuması geçerli: yedeğe düşmek, yasaklı konuyu tekrar etmenin
  // mazereti değil (2026-08-01 direktifi). Önce özneye göre ele, sonra başlığa göre.
  const fresh = seeds.filter(s => !clashingSubject(s.subject ?? s.title, bannedSubjects));
  const pool = (fresh.length ? fresh : seeds).filter(s => !recentTitles.includes(s.title));
  const usable = pool.length ? pool : (fresh.length ? fresh : seeds);
  const named = usable.filter(s => NAMED.test(s.title));
  const seed = pickSeed(named.length ? named : usable);
  console.error(`⚠ SEED FALLBACK (Gemini ${retries + 1} denemede üretemedi): ${seed.title}`);
  return {spec: seed, source: 'seed'};
}
