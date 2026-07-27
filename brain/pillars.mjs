// @byteflowlabs niş kilidi: her post bu AI/LLM engineering pillar'larından birinin içinde kalır.
// timely: true → güncel-haber pillar'ı (yeni çıkan özellik / yeni model sürümü; trend başlıklarına demir atar).
// Serdar direktifi (2026-07): postların %75'i timely pillar'lardan çıkar — bkz. selectPillar.
const AI_ENGINEERING = [
  {key: 'agents', focus: 'autonomous LLM agents: planning, tool use, loops, memory, multi-agent handoff'},
  {key: 'rag', focus: 'retrieval-augmented generation: chunking, embeddings, reranking, retrieval quality'},
  {key: 'context', focus: 'context windows: token budgets, context rot, prompt caching, long-context tradeoffs'},
  {key: 'embeddings', focus: 'embeddings and vector search: similarity, dimensions, hybrid search'},
  {key: 'inference', focus: 'inference and serving: latency, batching, KV cache, quantization, streaming'},
  {key: 'evaluation', focus: 'LLM evaluation: benchmarks, eval harnesses, LLM-as-judge pitfalls'},
  {key: 'prompting', focus: 'prompt engineering: structured output, few-shot, system prompts, failure modes'},
  {key: 'cost-latency', focus: 'cost and latency: token economics, caching, model routing, cheaper vs smarter'},
  {key: 'guardrails', focus: 'safety and guardrails: prompt injection, jailbreaks, output validation, PII'},
  {key: 'vector-db', focus: 'vector databases: HNSW/IVF indexing, metadata filtering, scaling retrieval'},
  {key: 'observability', focus: 'LLM observability: tracing, token accounting, debugging bad outputs'},
  {key: 'mcp-tools', focus: 'tool calling and MCP: function schemas, tool orchestration, Model Context Protocol'},
  {key: 'fine-tuning', focus: 'fine-tuning vs prompting vs RAG: when each wins, LoRA, data prep'},
  {key: 'model-internals', focus: 'how ChatGPT / Claude / Gemini actually work under the hood: tokens, context window, attention, next-token prediction, streaming'},
  {key: 'model-releases', timely: true, focus: 'what changed in the LATEST model release — a brand-new Claude / GPT / Gemini / Grok version bump from this week\'s headlines: the concrete differences that matter to users, not marketing claims. ALWAYS anchor on a timely trending headline'},
  {key: 'model-comparison', focus: 'Claude vs ChatGPT vs Gemini: real differences in context, strengths, pricing, when to use which'},
  {key: 'paid-tiers', focus: 'what Claude Max / ChatGPT Plus / Gemini Advanced actually buy you: bigger context, higher limits, smarter model, priority'},
  {key: 'reasoning-models', focus: "how 'thinking'/reasoning models (GPT-5, Claude extended thinking) work: predicting a scratchpad before the answer"},
  {key: 'assistant-features', focus: "what the AI assistants' platform features actually do under the hood: Claude Skills / Projects / Artifacts / MCP, ChatGPT custom GPTs / apps / plugins, Gemini Gems / extensions, Grok modes"},
  {key: 'coding-environments', timely: true, focus: 'agentic coding environments and their NEWLY shipped capabilities: Claude Code, Cursor, Copilot, Codex CLI — new skills, plugins, MCP servers, desktop apps; how these tools actually drive the model and where they fail. Prefer what just shipped from the trending headlines'},
  {key: 'assistant-updates', timely: true, focus: 'newly shipped features across Claude / ChatGPT / Gemini / Grok — e.g. a new desktop app, design tool, flow builder, voice/omni mode (use timely trending headlines): what shipped, how it actually works, whether it matters'},
];

// Cilt bakımı ETKEN MADDE BİLİMİ havuzu (TR kitle, kadın 18-35). Ürün tanıtımı DEĞİL:
// her konu bir MEKANİZMA — motorun 3 adımlı diyagram anlatımı buna birebir oturuyor.
// Veri: etken madde açıklayıcıları, ürün tanıtımlarını izlenme süresi ve kaydetmede geçiyor.
const SKINCARE_SCIENCE = [
  {key: 'aktifler', focus: 'aktif maddelerin cilt içinde NE YAPTIĞI: retinol/retinal, C vitamini, niasinamid, AHA/BHA, azelaik asit — hücre yenilenmesi, kolajen, pigment yolu'},
  {key: 'bariyer', focus: 'cilt bariyeri: seramid, kolesterol, yağ asidi dengesi, transepidermal su kaybı, bariyer bozulunca ne oluyor ve nasıl onarılıyor'},
  {key: 'nemlendirme', focus: 'nem tutucu/çekici/örtücü ayrımı: hyalüronik asit ne zaman kurutuyor, gliserin, üre, oklüzif katman mantığı'},
  {key: 'gunes', focus: 'güneş koruması: UVA/UVB farkı, SPF ve PA ne ölçer, filtre tipleri (mineral/kimyasal), yeniden sürme, yeni çıkan filtre teknolojileri'},
  {key: 'sira-ve-catisma', focus: 'ürün sırası ve etken madde çatışmaları: retinol + asit, C vitamini + niasinamid efsanesi, pH ve nüfuz sırası'},
  {key: 'akne', focus: 'akne mekanizması: gözenek tıkanması, C. acnes, sebum, hormonal akne döngüsü; komedojenik iddiasının ne kadar geçerli olduğu'},
  {key: 'pigment', focus: 'leke ve renk eşitsizliği: melanin üretim yolu, PIH ve melazma farkı, tirozinaz inhibitörleri, güneşin rolü'},
  {key: 'yaslanma', focus: 'yaşlanma biyolojisi: kolajen kaybı hızı, elastin, glikasyon, foto-yaşlanma; hangi iddia kanıtlı hangisi pazarlama'},
  {key: 'hassasiyet', focus: 'hassas cilt ve tahriş: parfüm/esans, alkol türleri, alerjen listeleri, "doğal" iddiasının anlamı; gündemdeki içerik tartışmaları'},
  {key: 'efsaneler', focus: 'yaygın efsanelerin mekanizmayla çürütülmesi: gözenek açılıp kapanmaz, pahalı formül daha etkili değildir, doğal her zaman güvenli değildir'},
  {key: 'rutin-tasarimi', focus: 'minimum etkili rutin: kaç adım gerçekten gerekli, hangi sırayla, ne kadar sürede sonuç beklenir (haftalar cinsinden gerçekçi takvim)'},
  // ÜRÜN-MERKEZLİ HAT (Serdar, 2026-07-28): hacim ürünün kendisinde — insanlar "şu serumu
  // alayım mı" diye düşünüyor. Ürünü DENEYEMEYİZ (faceless + otomatik), ama içerik listesi
  // herkese açık: üründen konuşup iddia satmadan analiz yapabiliriz.
  {key: 'icindekiler', timely: true, focus: 'Türkiye\'de çok satan bir cilt bakım ürününün YAYINLANMIŞ içerik listesini (INCI) okumak: hangi etken madde listenin neresinde, ne işe yarıyor, paranın çoğu neye gidiyor. Ürün adını açıkça söyle; "kötü/işe yaramaz" deme, "şu madde şu konumda, beklentin şu olmalı" de'},
  {key: 'muadil', timely: true, focus: 'aynı etken maddeyi çok daha ucuza veren muadil karşılaştırması: pahalı üründeki aktif ile uygun fiyatlı üründeki aktif aynı mı, formülasyon farkı gerçekten fark yaratıyor mu, fiyat farkı neye gidiyor'},
  {key: 'karsilastirma', timely: true, focus: 'iki popüler ürünü TEK bir boyutta kafa kafaya karşılaştırmak (aktif yoğunluğu, bariyer desteği, tahriş riski, kullanım sırası): hangisi hangi cilt için mantıklı'},
  {key: 'iddia-kontrol', timely: true, focus: 'bir markanın reklam cümlesini yayınlanmış mekanizmayla karşılaştırmak: "gözenek sıkılaştırır", "kolajeni geri getirir" gibi iddialar ne kadar destekleniyor, hangi kısmı doğru hangi kısmı abartı'},
  {key: 'cok-satanlar', timely: true, focus: 'şu an gündemde/çok satan bir ürün ya da trend (viral TikTok ürünü, yeni çıkan seri, sosyal medyada konuşulan içerik) — neden konuşuluyor ve mekanizması ne söylüyor'},
  {key: 'cihaz-ve-islem', timely: true, focus: 'ev tipi cihazlar ve klinik işlemler: LED maske, mikroakım, dermaroller riskleri, peeling dereceleri — ne işe yarıyor, ne yaramıyor'},
];

// Konu havuzları — marka dosyası hangi kümeyi kullanacağını söyler (brands/<slug>.json).
// Yeni niş = yeni küme; motor aynı kalır.
export const PILLAR_SETS = {'ai-engineering': AI_ENGINEERING, 'skincare-science': SKINCARE_SCIENCE};

/** Marka dosyasındaki pillarSet adına karşılık gelen havuz. */
export function pillarsFor(setName = 'ai-engineering') {
  const set = PILLAR_SETS[setName];
  if (!set) throw new Error(`bilinmeyen pillar kümesi: ${setName} (${Object.keys(PILLAR_SETS).join(', ')})`);
  return set;
}

// Geriye uyum: eski çağrılar doğrudan PILLARS kullanıyor.
export const PILLARS = AI_ENGINEERING;

// %75 güncel-içerik kuralı: 4 postluk deterministik pencerede 3 timely + 1 evergreen.
// postCount = bugüne kadarki toplam post sayısı (history.length).
// Seçilen grup içinde LRU: yakın zamanda kullanılmayanı, hepsi kullanıldıysa en eskisini seç.
// stats verilirse (bkz. brain/scoreboard.mjs) grup içinde PERFORMANSA göre ağırlıklı seçilir:
// tutan pillar'lar daha sık, hiç denenmemişler ortalama sayılır, hiçbiri tamamen ölmez.
// Veri yoksa (ilk haftalar) eski deterministik LRU davranışı aynen sürer.
export function selectPillar(recentKeys = [], postCount = 0, stats = null, pick = null, pillars = PILLARS) {
  const wantTimely = postCount % 4 !== 3;
  const group = pillars.filter(p => Boolean(p.timely) === wantTimely);
  const recent = new Set(recentKeys);
  const fresh = group.filter(p => !recent.has(p.key));
  const pool = fresh.length ? fresh : group;

  if (stats && pick && stats.sampleSize >= 3) {
    const key = pick(pool.map(p => p.key), stats);
    const hit = pool.find(p => p.key === key);
    if (hit) return hit;
  }
  if (fresh.length) return fresh[0];
  const oldestKey = recentKeys.find(k => group.some(p => p.key === k));
  return group.find(p => p.key === oldestKey) ?? group[0];
}
