# ByteFlow Faz 2 — Beyin (trend çekme + Gemini spec üretimi) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Güncel teknoloji/AI trendlerini RSS'ten çekip, **Gemini 2.5-flash** ile bunlardan en iyisini seçip geçerli bir `scene-spec.json` üretmek; üretim başarısızsa seed backlog'a düşerek Faz 1 render'ını besleyen tam otonom günlük akışı kurmak.

**Architecture:** Kök node projesine 3 modül eklenir. `fetch/fetch-trends.mjs` RSS → adaylar. `brain/generate-spec.mjs` Gemini'yi **responseSchema** (structured output) ile çağırır → doğrulanmış spec. `brain/produce-spec.mjs` retry + seed-backlog fallback sarar. `run-daily.mjs` hepsini + Faz 1 `build.mjs`'i zincirler.

**Tech Stack:** Node 22 (global fetch), `rss-parser`, Gemini REST (`generativelanguage.googleapis.com`, `gemini-2.5-flash`), mevcut `validateSpec` (Faz 1).

## Global Constraints

- **Gemini modeli:** `gemini-2.5-flash`. Endpoint `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=KEY`. Key `.env`'den `GEMINI_API_KEY` (asla koda gömme, asla logla, asla commit'e sokma — `.env` gitignore'da).
- **Structured output zorunlu:** `generationConfig.responseMimeType="application/json"` + `responseSchema`. Gemini çıktısı yine de `validateSpec` (Faz 1: schema + semantic from/to) ile doğrulanır — Gemini'ye güvenme, doğrula.
- **Üretilen spec Faz 1 sözleşmesine UYMALI:** `title`(3-60), `scenes`(1-3, `layout:"nodes-flow"`, `nodes`2-3 `{id,label(≤16),icon?}`, `steps`1-6 `{from,to,packet(≤6),color∈{accent,good,warn},status(≤40)}`), `caption`(≤2200), `hashtags`(1-30). from/to node id'lerine referans vermeli (semantic kontrol reddeder).
- **İçerik:** İngilizce, global tech/AI/ML/LLM/system-design. Ton: net, öğretici, "dev Instagram". Caption sonu `Follow @byteflow`.
- **Node sayısı ≤3** (4 teknik olarak sığar ama sade dursun — Gemini'ye 2-3 dedir).
- **Fallback zorunlu:** RSS boş / Gemini hata / doğrulama N denemede geçmezse → seed backlog'dan rastgele geçerli spec. Akış ASLA hata ile bitmez.
- **$0:** Gemini free tier, RSS keyless.

---

### Task 1: fetch-trends — RSS aday toplama

**Files:**
- Create: `fetch/fetch-trends.mjs`
- Modify: `package.json` (rss-parser dep + script)
- Test: `fetch/fetch-trends.test.mjs`

**Interfaces:**
- Produces: `fetchTrends({limit?=20, parser?}) => Promise<Array<{title, summary, link, source}>>` (named export). `parser` enjekte edilebilir (test için). CLI: `node fetch/fetch-trends.mjs` → `candidates.json` yazar.

- [ ] **Step 1: rss-parser ekle**

`package.json` içine `"dependencies": {"rss-parser": "^3.13.0"}` (ajv devDependencies'te kalabilir), scripts'e `"fetch": "node fetch/fetch-trends.mjs"`. Sonra `cd 16-byteflow-engine && npm install`.

- [ ] **Step 2: Failing test yaz**

`fetch/fetch-trends.test.mjs`:
```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchTrends} from './fetch-trends.mjs';

// Sahte parser: her feed için sabit item döndürür
const fakeParser = {
  parseURL: async (url) => ({
    items: [
      {title: `Item from ${url}`, contentSnippet: 'summary text', link: 'https://x/1'},
      {title: `Second ${url}`, contentSnippet: 'more', link: 'https://x/2'},
    ],
  }),
};

test('aggregates items across feeds with source + shape', async () => {
  const out = await fetchTrends({limit: 5, parser: fakeParser});
  assert.ok(out.length > 0 && out.length <= 5);
  for (const c of out) {
    assert.equal(typeof c.title, 'string');
    assert.equal(typeof c.summary, 'string');
    assert.equal(typeof c.link, 'string');
    assert.equal(typeof c.source, 'string');
  }
});

test('one failing feed does not break the rest', async () => {
  let n = 0;
  const flaky = {parseURL: async () => { if (n++ === 0) throw new Error('feed down'); return {items: [{title: 'ok', contentSnippet: 's', link: 'l'}]}; }};
  const out = await fetchTrends({limit: 5, parser: flaky});
  assert.ok(out.length >= 1);
});
```

- [ ] **Step 3: Testi çalıştır — FAIL bekle**

Run: `cd 16-byteflow-engine && node --test fetch/fetch-trends.test.mjs`
Expected: FAIL (module yok).

- [ ] **Step 4: fetch-trends.mjs implement et**

`fetch/fetch-trends.mjs`:
```js
import Parser from 'rss-parser';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const FEEDS = [
  {url: 'https://hnrss.org/frontpage', source: 'hackernews'},
  {url: 'http://export.arxiv.org/rss/cs.AI', source: 'arxiv-ai'},
  {url: 'http://export.arxiv.org/rss/cs.LG', source: 'arxiv-ml'},
  {url: 'https://www.redhat.com/en/rss/blog', source: 'redhat'},
  {url: 'https://medium.com/feed/tag/software-engineering', source: 'medium-se'},
];

export async function fetchTrends({limit = 20, parser = new Parser()} = {}) {
  const results = [];
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of (parsed.items ?? []).slice(0, 8)) {
        if (!item.title) continue;
        results.push({
          title: item.title.trim(),
          summary: (item.contentSnippet ?? item.content ?? '').slice(0, 400),
          link: item.link ?? '',
          source: feed.source,
        });
      }
    } catch (e) {
      console.error(`[fetch] ${feed.source} failed: ${e.message}`);
    }
  }
  return results.slice(0, limit);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await fetchTrends();
  writeFileSync(new URL('../candidates.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log(`✓ ${out.length} candidates → candidates.json`);
}
```

- [ ] **Step 5: Testi çalıştır — PASS bekle**

Run: `cd 16-byteflow-engine && node --test fetch/fetch-trends.test.mjs`
Expected: PASS (2 test).

- [ ] **Step 6: Canlı smoke (ağ)**

Run: `cd 16-byteflow-engine && node fetch/fetch-trends.mjs`
Expected: `✓ N candidates → candidates.json` (N>0). Ağ yoksa hata basar ama çökmez; en az 1 feed dönerse yeter.

- [ ] **Step 7: Commit**

```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): fetch-trends RSS aggregator"
```

---

### Task 2: seed-backlog + Gemini spec üretimi + fallback

**Files:**
- Create: `brain/seed-backlog.json`
- Create: `brain/generate-spec.mjs`
- Create: `brain/produce-spec.mjs`
- Test: `brain/produce-spec.test.mjs`

**Interfaces:**
- Consumes: `validateSpec` (from `./validate.mjs`, Faz 1), aday listesi (Task 1 şekli).
- Produces:
  - `generateSpec({candidates, apiKey, fetchFn?=fetch}) => Promise<object>` — Gemini'yi responseSchema ile çağırır, ham spec objesi döndürür (doğrulama produce katmanında). `brain/generate-spec.mjs`.
  - `produceSpec({candidates, apiKey, generate?=generateSpec, retries?=2, pickSeed?}) => Promise<{spec, source}>` — retry + `validateSpec`; hepsi başarısızsa seed. `brain/produce-spec.mjs`.
  - `SEED_BACKLOG` — geçerli spec dizisi (`brain/seed-backlog.json`).

- [ ] **Step 1: seed-backlog.json yaz**

`brain/seed-backlog.json` — en az 12 tam GEÇERLİ scene-spec objesinden oluşan dizi (her biri Faz 1 şemasına + semantic'e uyar: nodes 2-3, steps from/to gerçek id, caption `Follow @byteflow` ile biter). Konular: HTTP request lifecycle, Load balancer, Caching (Redis), Database indexing, Message queue (Kafka), CDN, DNS resolution, JWT auth flow, Rate limiting, Microservices vs monolith, API gateway, Docker container lifecycle. Her biri şu şablonda (id'ler eşleşmeli):
```json
{
  "title": "How Caching Speeds Up Apps",
  "topic_source": "seed",
  "caption": "A cache stores hot data in fast memory so repeat requests skip the slow database. Follow @byteflow for daily systems & AI breakdowns.",
  "hashtags": ["#systemdesign", "#caching", "#redis", "#backend", "#softwareengineering"],
  "scenes": [
    {"layout": "nodes-flow", "heading": "Cache hit path",
     "nodes": [{"id":"app","icon":"🖥️","label":"APP"},{"id":"cache","icon":"⚡","label":"CACHE"},{"id":"db","icon":"🗄️","label":"DATABASE"}],
     "steps": [
       {"from":"app","to":"cache","packet":"GET","color":"accent","status":"check cache first"},
       {"from":"cache","to":"app","packet":"HIT","color":"good","status":"fast in-memory hit"}
     ]}
  ]
}
```
(Diğer 11 konu aynı titizlikle. `validate` ile hepsini tek tek doğrula — Step 5.)

- [ ] **Step 2: generate-spec.mjs implement et**

`brain/generate-spec.mjs`:
```js
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

// Gemini responseSchema — scene-spec şeklini ZORLAR
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['title', 'scenes', 'caption', 'hashtags'],
  properties: {
    title: {type: 'STRING'},
    caption: {type: 'STRING'},
    hashtags: {type: 'ARRAY', items: {type: 'STRING'}},
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['layout', 'nodes', 'steps'],
        properties: {
          layout: {type: 'STRING', enum: ['nodes-flow']},
          heading: {type: 'STRING'},
          nodes: {type: 'ARRAY', items: {type: 'OBJECT', required: ['id', 'label'],
            properties: {id: {type: 'STRING'}, label: {type: 'STRING'}, icon: {type: 'STRING'}}}},
          steps: {type: 'ARRAY', items: {type: 'OBJECT', required: ['from', 'to', 'packet', 'status'],
            properties: {from: {type: 'STRING'}, to: {type: 'STRING'}, packet: {type: 'STRING'},
              color: {type: 'STRING', enum: ['accent', 'good', 'warn']}, status: {type: 'STRING'}}}},
        },
      },
    },
  },
};

const PROMPT = (candidates) => `You are the content brain for @byteflow, an Instagram page of clean animated
software/AI explainer Reels (flat dark diagrams: boxes = components, packets = data flowing between them).

From these trending tech headlines, pick the SINGLE best topic to explain as a 10-20s animated diagram,
then produce a scene-spec. Prefer timeless system-design / AI-infra concepts the headline evokes over
ephemeral news. Make it globally understandable, English.

Rules:
- 1 to 3 scenes. Each scene layout is exactly "nodes-flow".
- 2 to 3 nodes per scene. node.label <= 16 chars, UPPERCASE. node.icon = ONE emoji.
- 1 to 6 steps per scene. Each step.from and step.to MUST equal an existing node.id IN THAT SCENE.
- step.packet <= 6 chars (e.g. "GET", "200", "SYN"). step.color in {accent, good, warn}. step.status <= 40 chars, lowercase.
- title <= 60 chars. caption ends with "Follow @byteflow for daily systems & AI breakdowns." 3-6 hashtags.

Headlines:
${candidates.slice(0, 15).map((c, i) => `${i + 1}. [${c.source}] ${c.title}`).join('\n')}`;

export async function generateSpec({candidates, apiKey, fetchFn = fetch}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const res = await fetchFn(ENDPOINT(apiKey), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      contents: [{parts: [{text: PROMPT(candidates)}]}],
      generationConfig: {responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.9},
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return JSON.parse(text);
}
```

- [ ] **Step 3: produce-spec.mjs implement et**

`brain/produce-spec.mjs`:
```js
import {readFileSync} from 'node:fs';
import {validateSpec} from './validate.mjs';
import {generateSpec} from './generate-spec.mjs';

export const SEED_BACKLOG = JSON.parse(
  readFileSync(new URL('./seed-backlog.json', import.meta.url)),
);

function pickSeedDefault(seeds) {
  // deterministik olmayan seçim; index'i title uzunluğuna göre kaydır (Math.random yasak değil ama gerekmez)
  return seeds[(Date.now ? 0 : 0)] ?? seeds[0]; // controller CLI'de gerçek rastgeleyi verir
}

export async function produceSpec({candidates, apiKey, generate = generateSpec, retries = 2, pickSeed = pickSeedDefault}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const spec = await generate({candidates, apiKey});
      const {valid, errors} = validateSpec(spec);
      if (valid) return {spec, source: 'gemini'};
      console.error(`[produce] attempt ${attempt} invalid: ${errors.join('; ')}`);
    } catch (e) {
      console.error(`[produce] attempt ${attempt} error: ${e.message}`);
    }
  }
  const seed = pickSeed(SEED_BACKLOG);
  return {spec: seed, source: 'seed'};
}
```

- [ ] **Step 4: Failing test yaz**

`brain/produce-spec.test.mjs`:
```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {produceSpec, SEED_BACKLOG} from './produce-spec.mjs';
import {validateSpec} from './validate.mjs';

const cands = [{title: 'X', summary: 's', link: 'l', source: 'hn'}];

test('every seed in backlog is a valid spec', () => {
  assert.ok(SEED_BACKLOG.length >= 12);
  for (const s of SEED_BACKLOG) {
    const {valid, errors} = validateSpec(s);
    assert.equal(valid, true, `${s.title}: ${errors.join(';')}`);
  }
});

test('uses gemini result when valid', async () => {
  const fakeGood = async () => SEED_BACKLOG[0];
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', generate: fakeGood});
  assert.equal(source, 'gemini');
  assert.equal(spec.title, SEED_BACKLOG[0].title);
});

test('falls back to seed when generator keeps failing', async () => {
  const fakeBad = async () => { throw new Error('boom'); };
  const {spec, source} = await produceSpec({candidates: cands, apiKey: 'x', generate: fakeBad, retries: 1, pickSeed: s => s[2]});
  assert.equal(source, 'seed');
  assert.equal(validateSpec(spec).valid, true);
});

test('falls back when gemini returns invalid spec', async () => {
  const fakeInvalid = async () => ({title: 'x', scenes: [], caption: 'c', hashtags: []});
  const {source} = await produceSpec({candidates: cands, apiKey: 'x', generate: fakeInvalid, retries: 0, pickSeed: s => s[0]});
  assert.equal(source, 'seed');
});
```

- [ ] **Step 5: Testleri çalıştır — PASS bekle**

Run: `cd 16-byteflow-engine && node --test brain/produce-spec.test.mjs`
Expected: PASS (4 test). Seed doğrulaması geçmezse ilgili seed'i düzelt.

- [ ] **Step 6: Canlı Gemini smoke (opsiyonel ama önerilir)**

Run:
```bash
cd 16-byteflow-engine && node --env-file=.env -e "import('./fetch/fetch-trends.mjs').then(async m=>{const c=await m.fetchTrends({limit:15});const p=await import('./brain/produce-spec.mjs');const r=await p.produceSpec({candidates:c,apiKey:process.env.GEMINI_API_KEY,pickSeed:s=>s[0]});console.log(r.source, JSON.stringify(r.spec).slice(0,200));})"
```
Expected: `gemini {...}` — canlı trendden geçerli spec üretti. (seed dönerse Gemini/şema logunu incele.)

- [ ] **Step 7: Commit**

```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): gemini spec generation + seed fallback"
```

---

### Task 3: run-daily orkestrasyon (fetch → produce → render → müzik)

**Files:**
- Create: `run-daily.mjs`
- Modify: `package.json` (script `daily`)
- Modify: `README.md` (günlük akış + Faz 2 notu)

**Interfaces:**
- Consumes: `fetchTrends` (Task 1), `produceSpec` (Task 2), Faz 1 `build.mjs` mantığı.
- Produces: `dist/final.mp4` gerçek trendden. CLI: `node --env-file=.env run-daily.mjs`.

- [ ] **Step 1: run-daily.mjs implement et**

`run-daily.mjs`:
```js
import {writeFileSync, mkdirSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fetchTrends} from './fetch/fetch-trends.mjs';
import {produceSpec} from './brain/produce-spec.mjs';
import {postProcess} from './publish/post-process.mjs';

const root = fileURLToPath(new URL('./', import.meta.url));
const apiKey = process.env.GEMINI_API_KEY;

function randomSeed(seeds) {
  // Math.random burada serbest (CLI, resume yok)
  return seeds[Math.floor(Math.random() * seeds.length)];
}

const candidates = await fetchTrends({limit: 15});
console.log(`✓ ${candidates.length} trends`);
const {spec, source} = await produceSpec({candidates, apiKey, pickSeed: randomSeed});
console.log(`✓ spec (${source}): ${spec.title}`);

const specPath = join(root, 'scene-spec.generated.json');
writeFileSync(specPath, JSON.stringify(spec, null, 2));
writeFileSync(join(root, 'render', 'scene-spec.json'), JSON.stringify(spec, null, 2));

execFileSync('npm', ['run', 'render'], {cwd: join(root, 'render'), stdio: 'inherit', shell: true});

const musicDir = join(root, 'assets', 'music');
const mp3 = readdirSync(musicDir).find(f => f.endsWith('.mp3') && !f.startsWith('_'));
mkdirSync(join(root, 'dist'), {recursive: true});
const out = postProcess({
  videoPath: join(root, 'render', 'output', 'project.mp4'),
  musicPath: join(musicDir, mp3),
  outPath: join(root, 'dist', 'final.mp4'),
});
console.log(`✓ done (${source}): ${out}`);
```

- [ ] **Step 2: package.json script**

Kök `scripts`'e: `"daily": "node --env-file=.env run-daily.mjs"`.

- [ ] **Step 3: Uçtan uca CANLI çalıştır**

Run: `cd 16-byteflow-engine && npm run daily`
Expected: `✓ N trends` → `✓ spec (gemini): <başlık>` → render → `✓ done (gemini): .../dist/final.mp4`.

- [ ] **Step 4: Doğrula (verification-before-completion)**

Run: `ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of default=noprint_wrappers=1 16-byteflow-engine/dist/final.mp4`
Expected: 1080×1920, video+audio. Ayrıca `cat 16-byteflow-engine/scene-spec.generated.json` ile Gemini'nin ürettiği konuyu incele (mantıklı mı, from/to tutarlı mı).

- [ ] **Step 5: README + commit**

README'ye "Faz 2: `npm run daily` = trend→Gemini→video (fallback seed)" ekle.
```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): daily orchestrator trend->gemini->video"
```

---

## Self-Review Notları
- **Kapsam:** fetch (Task 1) + Gemini/fallback (Task 2) + orkestrasyon (Task 3) = Faz 2 tam. Yayın (Graph API) + cron = Faz 3, DIŞARIDA.
- **Kalite kapısı:** Gemini responseSchema + `validateSpec` (schema+semantic from/to) + retry + seed fallback = dört katmanlı güvence.
- **Risk:** Gemini bazen şemaya uysa da anlamsız içerik üretebilir (ör. tek node'a step). Semantic validate from/to'yu yakalar; içerik "mantık" kalitesi ilk hafta gözlemlenmeli (design doc: yarı-gözlemli başlangıç).
- **`--env-file=.env`** Node 20.6+ ile gelir (22.18 var). Key sadece process.env'e girer, loglanmaz.
