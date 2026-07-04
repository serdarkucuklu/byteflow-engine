# ByteFlow Faz 1 — Çekirdek Render Motoru — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elle yazılmış bir `scene-spec.json`'dan, `software_engineer_paris` estetiğinde dikey (1080×1920) + royalty-free müzikli tek bir Instagram Reel mp4'ü uçtan uca üretmek.

**Architecture:** İki node projesi. `render/` = veri-güdümlü generic Motion Canvas şablonu; girdisi `scene-spec.json`, çıktısı sessiz dikey mp4 (Playwright ile headless render). Kök proje = `ajv` şema doğrulama + `ffmpeg` ile müzik mux + uçtan uca orkestrasyon. Beyin (Gemini) ve yayın (Graph API) bu fazda YOK.

**Tech Stack:** Motion Canvas 3.17 (TS), Vite 4, `@motion-canvas/ffmpeg`, Playwright (headless render tetikleme), ffmpeg CLI, ajv, Node 22.

## Global Constraints

- **Vite sürümü tam olarak `^4.5.5`** — `@motion-canvas/ffmpeg@1.1.x` peer olarak vite@4 ister; vite@5 `ERESOLVE` verir.
- **Plugin CJS→ESM interop:** `vite.config.ts`'te `const motionCanvas = (imp as any).default ?? imp;` (ffmpeg plugin için de aynı) — aksi halde `motionCanvas is not a function`.
- **Render çözünürlüğü tam `1080×1920`** (dikey Reels). Render-runner bu değeri Video Settings alanlarına yazar.
- **İçerik dili İngilizce.** Seslendirme/altyazı YOK — metin animasyonun içinde.
- **Renk paleti (sabit):** BG `#0d1117`, CARD `#161b22`, STROKE `#30363d`, accent `#58a6ff`, good `#3fb950`, warn `#d29922`, text `#e6edf3`, muted `#8b949e`.
- **Marka:** wordmark `BYTEFLOW`, handle `@byteflow`. Intro + outro şablonun içinde.
- **Maliyet $0:** yalnızca açık kaynak/free-tier bağımlılık. Müzik = repoya elle konan Pixabay/royalty-free mp3; testte ffmpeg ile sentetik ton üretilir.
- **Font:** `JetBrains Mono` (yoksa sistem mono fallback) — mono/flat estetik.

---

### Task 1: Proje iskeleti + `scene-spec` şeması + doğrulayıcı

**Files:**
- Create: `16-byteflow-engine/package.json`
- Create: `16-byteflow-engine/.gitignore`
- Create: `16-byteflow-engine/scene-spec.schema.json`
- Create: `16-byteflow-engine/scene-spec.example.json`
- Create: `16-byteflow-engine/brain/validate.mjs`
- Test: `16-byteflow-engine/brain/validate.test.mjs`

**Interfaces:**
- Produces: `validateSpec(spec) => {valid: boolean, errors: string[]}` (named export from `brain/validate.mjs`).
- Produces: `scene-spec.schema.json` — draft-07 şema; `scene-spec.example.json` — geçerli örnek (Load Balancer).

- [ ] **Step 1: Kök package.json oluştur**

`16-byteflow-engine/package.json`:
```json
{
  "name": "byteflow-engine",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "validate": "node brain/validate.mjs scene-spec.example.json"
  },
  "devDependencies": {
    "ajv": "^8.17.1"
  }
}
```

- [ ] **Step 2: .gitignore oluştur**

`16-byteflow-engine/.gitignore`:
```
node_modules/
render/node_modules/
render/output/
dist/
*.log
.env
.playwright-mcp/
```

- [ ] **Step 3: bağımlılıkları kur**

Run: `cd 16-byteflow-engine && npm install`
Expected: `ajv` kurulur, hata yok.

- [ ] **Step 4: Şemayı yaz**

`16-byteflow-engine/scene-spec.schema.json`:
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["title", "scenes", "caption", "hashtags"],
  "additionalProperties": true,
  "properties": {
    "title": {"type": "string", "minLength": 3, "maxLength": 60},
    "topic_source": {"type": "string"},
    "caption": {"type": "string", "minLength": 1, "maxLength": 2200},
    "hashtags": {"type": "array", "items": {"type": "string"}, "minItems": 1, "maxItems": 30},
    "scenes": {
      "type": "array", "minItems": 1, "maxItems": 3,
      "items": {
        "type": "object",
        "required": ["layout", "nodes", "steps"],
        "properties": {
          "layout": {"type": "string", "enum": ["nodes-flow"]},
          "heading": {"type": "string", "maxLength": 48},
          "nodes": {
            "type": "array", "minItems": 2, "maxItems": 4,
            "items": {
              "type": "object",
              "required": ["id", "label"],
              "properties": {
                "id": {"type": "string"},
                "label": {"type": "string", "maxLength": 16},
                "icon": {"type": "string", "maxLength": 4}
              }
            }
          },
          "steps": {
            "type": "array", "minItems": 1, "maxItems": 6,
            "items": {
              "type": "object",
              "required": ["from", "to", "packet", "status"],
              "properties": {
                "from": {"type": "string"},
                "to": {"type": "string"},
                "packet": {"type": "string", "maxLength": 6},
                "color": {"type": "string", "enum": ["accent", "good", "warn"]},
                "status": {"type": "string", "maxLength": 40}
              }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 5: Örnek spec'i yaz**

`16-byteflow-engine/scene-spec.example.json`:
```json
{
  "title": "How a Load Balancer Works",
  "topic_source": "hand-authored",
  "caption": "A load balancer spreads incoming traffic across servers so no single one gets overwhelmed. Here's the flow. Follow @byteflow for daily systems & AI breakdowns.",
  "hashtags": ["#systemdesign", "#backend", "#loadbalancer", "#softwareengineering", "#devops"],
  "scenes": [
    {
      "layout": "nodes-flow",
      "heading": "Request distribution",
      "nodes": [
        {"id": "client", "icon": "🖥️", "label": "CLIENT"},
        {"id": "lb", "icon": "⚖️", "label": "BALANCER"}
      ],
      "steps": [
        {"from": "client", "to": "lb", "packet": "REQ", "color": "accent", "status": "incoming request"}
      ]
    },
    {
      "layout": "nodes-flow",
      "heading": "Fan-out to servers",
      "nodes": [
        {"id": "lb", "icon": "⚖️", "label": "BALANCER"},
        {"id": "s1", "icon": "🗄️", "label": "SERVER 1"},
        {"id": "s2", "icon": "🗄️", "label": "SERVER 2"}
      ],
      "steps": [
        {"from": "lb", "to": "s1", "packet": "REQ", "color": "accent", "status": "route to least-busy"},
        {"from": "s2", "to": "lb", "packet": "200", "color": "good", "status": "healthy response"}
      ]
    }
  ]
}
```

- [ ] **Step 6: Failing test yaz**

`16-byteflow-engine/brain/validate.test.mjs`:
```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSpec} from './validate.mjs';

test('valid example spec passes', () => {
  const spec = JSON.parse(readFileSync(new URL('../scene-spec.example.json', import.meta.url)));
  const res = validateSpec(spec);
  assert.equal(res.valid, true, JSON.stringify(res.errors));
});

test('missing title fails', () => {
  const res = validateSpec({scenes: [], caption: 'x', hashtags: ['#a']});
  assert.equal(res.valid, false);
});

test('scene with <2 nodes fails', () => {
  const spec = {
    title: 'X title', caption: 'c', hashtags: ['#a'],
    scenes: [{layout: 'nodes-flow', nodes: [{id: 'a', label: 'A'}], steps: [{from: 'a', to: 'a', packet: 'X', status: 's'}]}]
  };
  assert.equal(validateSpec(spec).valid, false);
});
```

- [ ] **Step 7: Testi çalıştır — FAIL bekle**

Run: `cd 16-byteflow-engine && node --test brain/validate.test.mjs`
Expected: FAIL — `Cannot find module './validate.mjs'` / `validateSpec is not a function`.

- [ ] **Step 8: validate.mjs implement et**

`16-byteflow-engine/brain/validate.mjs`:
```js
import Ajv from 'ajv';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const schema = JSON.parse(
  readFileSync(new URL('../scene-spec.schema.json', import.meta.url)),
);
const ajv = new Ajv({allErrors: true});
const validate = ajv.compile(schema);

export function validateSpec(spec) {
  const valid = validate(spec);
  const errors = valid ? [] : validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`);
  return {valid, errors};
}

// CLI: node brain/validate.mjs <path>
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  const spec = JSON.parse(readFileSync(path));
  const res = validateSpec(spec);
  console.log(res.valid ? '✓ valid' : '✗ invalid:\n' + res.errors.join('\n'));
  process.exit(res.valid ? 0 : 1);
}
```

- [ ] **Step 9: Testi çalıştır — PASS bekle**

Run: `cd 16-byteflow-engine && node --test brain/validate.test.mjs`
Expected: PASS (3 test).

- [ ] **Step 10: Commit**

```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): scene-spec schema + validator"
```
(Not: Playground git repo değilse bu adımı atla veya önce `git init` — kullanıcıya sor.)

---

### Task 2: Render projesi iskeleti + spec yükleme + saf yardımcılar

**Files:**
- Create: `16-byteflow-engine/render/package.json`
- Create: `16-byteflow-engine/render/vite.config.ts`
- Create: `16-byteflow-engine/render/tsconfig.json`
- Create: `16-byteflow-engine/render/src/project.ts`
- Create: `16-byteflow-engine/render/src/lib/spec.ts`
- Test: `16-byteflow-engine/render/src/lib/spec.test.mjs`

**Interfaces:**
- Consumes: `scene-spec.schema.json` biçimindeki spec (Task 1).
- Produces: `resolveColor(token: string) => string` ve `COLORS` sabiti; `nodeXPositions(count: number) => number[]` (yatay merkezlenmiş x koordinatları) — named export'lar `src/lib/spec.ts`'ten.

- [ ] **Step 1: render/package.json**

```json
{
  "name": "byteflow-render",
  "private": true,
  "type": "module",
  "scripts": {"serve": "vite"},
  "devDependencies": {
    "@motion-canvas/2d": "^3.17.2",
    "@motion-canvas/core": "^3.17.2",
    "@motion-canvas/ffmpeg": "^1.1.0",
    "@motion-canvas/ui": "^3.17.2",
    "@motion-canvas/vite-plugin": "^3.17.2",
    "playwright": "^1.48.0",
    "typescript": "^5.5.4",
    "vite": "^4.5.5"
  }
}
```

- [ ] **Step 2: vite.config.ts (interop fix)**

```ts
import {defineConfig} from 'vite';
import motionCanvasImport from '@motion-canvas/vite-plugin';
import ffmpegImport from '@motion-canvas/ffmpeg';

const motionCanvas = (motionCanvasImport as any).default ?? motionCanvasImport;
const ffmpeg = (ffmpegImport as any).default ?? ffmpegImport;

export default defineConfig({plugins: [motionCanvas(), ffmpeg()]});
```

- [ ] **Step 3: tsconfig.json**

```json
{
  "extends": "@motion-canvas/2d/tsconfig.project.json",
  "compilerOptions": {"jsx": "preserve", "jsxImportSource": "@motion-canvas/2d/lib"}
}
```

- [ ] **Step 4: project.ts**

```ts
import {makeProject} from '@motion-canvas/core';
import explainer from './scenes/explainer?scene';

export default makeProject({scenes: [explainer]});
```

- [ ] **Step 5: kur + chromium**

Run: `cd 16-byteflow-engine/render && npm install && npx playwright install chromium`
Expected: kurulum tamam, chromium indirildi.

- [ ] **Step 6: Failing test yaz**

`16-byteflow-engine/render/src/lib/spec.test.mjs`:
```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveColor, nodeXPositions, COLORS} from './spec.ts';

test('resolveColor maps tokens', () => {
  assert.equal(resolveColor('accent'), COLORS.accent);
  assert.equal(resolveColor('good'), COLORS.good);
});

test('resolveColor falls back to accent', () => {
  assert.equal(resolveColor('nope'), COLORS.accent);
});

test('nodeXPositions centers 2 nodes', () => {
  const xs = nodeXPositions(2);
  assert.equal(xs.length, 2);
  assert.equal(xs[0], -xs[1]); // symmetric around 0
});

test('nodeXPositions centers 3 nodes with middle at 0', () => {
  const xs = nodeXPositions(3);
  assert.equal(xs[1], 0);
});
```
(Not: `.ts` importunu node çalıştırabilmesi için Step 7'de `--experimental-strip-types` kullanılır; saf tip-siz fonksiyonlar olduğundan sorun çıkmaz.)

- [ ] **Step 7: Testi çalıştır — FAIL bekle**

Run: `cd 16-byteflow-engine/render && node --experimental-strip-types --test src/lib/spec.test.mjs`
Expected: FAIL — module bulunamıyor.

- [ ] **Step 8: spec.ts implement et**

`16-byteflow-engine/render/src/lib/spec.ts`:
```ts
export const COLORS = {
  bg: '#0d1117', card: '#161b22', stroke: '#30363d',
  accent: '#58a6ff', good: '#3fb950', warn: '#d29922',
  text: '#e6edf3', muted: '#8b949e',
} as const;

export function resolveColor(token: string): string {
  return (COLORS as Record<string, string>)[token] ?? COLORS.accent;
}

// count kadar yatay merkezlenmiş x koordinatı (360px aralık)
export function nodeXPositions(count: number): number[] {
  const gap = 360;
  const start = -((count - 1) * gap) / 2;
  return Array.from({length: count}, (_, i) => start + i * gap);
}

export interface SpecNode {id: string; label: string; icon?: string}
export interface SpecStep {from: string; to: string; packet: string; color?: string; status: string}
export interface SpecScene {layout: string; heading?: string; nodes: SpecNode[]; steps: SpecStep[]}
export interface SceneSpec {
  title: string; caption: string; hashtags: string[];
  topic_source?: string; scenes: SpecScene[];
}
```

- [ ] **Step 9: Testi çalıştır — PASS bekle**

Run: `cd 16-byteflow-engine/render && node --experimental-strip-types --test src/lib/spec.test.mjs`
Expected: PASS (4 test).

- [ ] **Step 10: Commit**

```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): render scaffold + spec helpers"
```

---

### Task 3: Generic Motion Canvas şablonu (dikey, marka, nodes-flow, çok-sahneli)

**Files:**
- Create: `16-byteflow-engine/render/src/scenes/explainer.tsx`
- Create: `16-byteflow-engine/render/scene-spec.json` (Task 1'deki example'ın kopyası — render girdisi)

**Interfaces:**
- Consumes: `resolveColor`, `nodeXPositions`, `SceneSpec` (Task 2); `render/scene-spec.json` (import).
- Produces: `render/src/scenes/explainer.tsx` — default Motion Canvas sahnesi. Manuel görsel doğrulama ile test edilir (otomatik render Task 4).

- [ ] **Step 1: scene-spec.json'ı render'a kopyala**

Run: `cp 16-byteflow-engine/scene-spec.example.json 16-byteflow-engine/render/scene-spec.json`

- [ ] **Step 2: explainer.tsx implement et**

`16-byteflow-engine/render/src/scenes/explainer.tsx`:
```tsx
import {makeScene2D, Rect, Txt, Line, Layout} from '@motion-canvas/2d';
import {all, createRef, waitFor, easeInOutCubic, easeOutBack} from '@motion-canvas/core';
import {COLORS, resolveColor, nodeXPositions, type SceneSpec} from '../lib/spec';
import specJson from '../../scene-spec.json';

const spec = specJson as unknown as SceneSpec;
const MONO = 'JetBrains Mono, monospace';

export default makeScene2D(function* (view) {
  view.fill(COLORS.bg);

  // ---- Brand intro ----
  const brand = createRef<Txt>();
  const brandSub = createRef<Txt>();
  view.add(<Txt ref={brand} text="BYTEFLOW" fill={COLORS.text} fontFamily={MONO}
    fontSize={96} fontWeight={800} letterSpacing={12} opacity={0} y={-40} />);
  view.add(<Txt ref={brandSub} text="@byteflow" fill={COLORS.accent} fontFamily={MONO}
    fontSize={40} letterSpacing={6} opacity={0} y={60} />);
  yield* brand().opacity(1, 0.5);
  yield* brandSub().opacity(1, 0.3);
  yield* waitFor(0.6);
  yield* all(brand().opacity(0, 0.4), brandSub().opacity(0, 0.4));

  // ---- Persistent title (topic) ----
  const title = createRef<Txt>();
  view.add(<Txt ref={title} text={spec.title.toUpperCase()} fill={COLORS.muted}
    fontFamily={MONO} fontSize={46} letterSpacing={4} y={-780} opacity={0}
    width={960} textAlign="center" textWrap />);
  yield* title().opacity(1, 0.4);

  // ---- Her sahne ----
  for (const scene of spec.scenes) {
    const container = createRef<Layout>();
    view.add(<Layout ref={container} opacity={0} />);

    const heading = createRef<Txt>();
    container().add(<Txt ref={heading} text={scene.heading ?? ''} fill={COLORS.text}
      fontFamily={MONO} fontSize={40} y={-520} opacity={0.9} />);

    // Nodes
    const xs = nodeXPositions(scene.nodes.length);
    const boxes: Record<string, Rect> = {};
    scene.nodes.forEach((n, i) => {
      const box = createRef<Rect>();
      container().add(
        <Rect ref={box} width={300} height={220} radius={28} fill={COLORS.card}
          stroke={COLORS.stroke} lineWidth={3} x={xs[i]} y={0} scale={0}>
          {n.icon ? <Txt text={n.icon} fontSize={72} y={-34} /> : null}
          <Txt text={n.label} fill={COLORS.text} fontFamily={MONO} fontSize={28} y={50} />
        </Rect>,
      );
      boxes[n.id] = box();
    });

    // Status satırı
    const status = createRef<Txt>();
    container().add(<Txt ref={status} text="" fill={COLORS.muted}
      fontFamily={MONO} fontSize={38} y={520} />);

    // Sahneyi göster
    yield* container().opacity(1, 0.4);
    yield* all(...scene.nodes.map(n => boxes[n.id].scale(1, 0.5, easeOutBack)));

    // Adımlar: paket uçuşu
    for (const step of scene.steps) {
      const from = boxes[step.from], to = boxes[step.to];
      if (!from || !to) continue;
      const col = resolveColor(step.color ?? 'accent');
      const packet = createRef<Rect>();
      container().add(
        <Rect ref={packet} width={110} height={64} radius={14} fill={col}
          x={from.x()} y={from.y()} opacity={0}>
          <Txt text={step.packet} fill={COLORS.bg} fontFamily={MONO} fontSize={26} fontWeight={700} />
        </Rect>,
      );
      status().text(step.status);
      status().fill(col);
      yield* packet().opacity(1, 0.2);
      yield* all(
        packet().x(to.x(), 1.0, easeInOutCubic),
        packet().y(to.y(), 1.0, easeInOutCubic),
      );
      yield* all(packet().opacity(0, 0.2), to.stroke(col, 0.2));
      yield* waitFor(0.2);
      yield* to.stroke(COLORS.stroke, 0.3);
    }

    yield* waitFor(0.4);
    yield* container().opacity(0, 0.4); // sahneler arası fade geçiş
    container().remove();
  }

  // ---- Brand outro ----
  yield* title().opacity(0, 0.3);
  const outro = createRef<Txt>();
  const cta = createRef<Txt>();
  view.add(<Txt ref={outro} text="BYTEFLOW" fill={COLORS.text} fontFamily={MONO}
    fontSize={88} fontWeight={800} letterSpacing={12} opacity={0} y={-30} />);
  view.add(<Txt ref={cta} text="follow @byteflow for more" fill={COLORS.accent}
    fontFamily={MONO} fontSize={38} opacity={0} y={60} />);
  yield* all(outro().opacity(1, 0.5), cta().opacity(1, 0.5));
  yield* waitFor(1.2);
});
```

- [ ] **Step 3: Manuel görsel doğrulama**

Run: `cd 16-byteflow-engine/render && npm run serve`
Sonra tarayıcıda `http://localhost:9000` aç, **Play**'e bas.
Expected: BYTEFLOW intro → başlık → 2 sahne (paketler akıyor, node stroke renk değişimi) → outro. Konsol hatası yok. Doğrulayınca server'ı durdur (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): generic vertical explainer template"
```

---

### Task 4: Headless render-runner (Playwright → sessiz dikey mp4)

**Files:**
- Create: `16-byteflow-engine/render/render-runner.mjs`
- Modify: `16-byteflow-engine/render/package.json` (script ekle)
- Test: `16-byteflow-engine/render/render-runner.test.mjs`

**Interfaces:**
- Consumes: çalışan `vite` dev server (script içinde başlatılır), `render/scene-spec.json`.
- Produces: `render/output/project.mp4` (H.264, 1080×1920, sessiz). CLI: `node render-runner.mjs`.

- [ ] **Step 1: render-runner.mjs implement et**

`16-byteflow-engine/render/render-runner.mjs`:
```js
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {setTimeout as sleep} from 'node:timers/promises';
import {existsSync, rmSync} from 'node:fs';

const PORT = 9000;
const OUT = new URL('./output/project.mp4', import.meta.url);

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return; } catch {}
    await sleep(500);
  }
  throw new Error('dev server did not start');
}

async function main() {
  if (existsSync(OUT)) rmSync(OUT);
  const server = spawn('npm', ['run', 'serve'], {cwd: new URL('.', import.meta.url), shell: true});
  server.stdout.on('data', d => process.stdout.write(`[vite] ${d}`));

  const browser = await chromium.launch();
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('text=Video Settings', {timeout: 30000});

    // Çözünürlük 1080x1920
    const res = page.locator('input[type=number]');
    // resolution alanları: Video Settings > General > resolution (width, height)
    await page.evaluate(() => {
      const setNum = (el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); };
      const nums = [...document.querySelectorAll('input[type=number]')];
      // width=1920 default olan ilk 1920'yi 1080, ardından 1080'i 1920 yap
      const w = nums.find(n => n.value === '1920');
      const h = nums.find(n => n.value === '1080');
      if (w) setNum(w, 1080);
      if (h) setNum(h, 1920);
    });

    // Exporter = Video (FFmpeg)
    await page.evaluate(() => {
      const sel = [...document.querySelectorAll('select')].find(s =>
        [...s.options].some(o => /ffmpeg/i.test(o.textContent)));
      const opt = [...sel.options].find(o => /ffmpeg/i.test(o.textContent));
      sel.value = opt.value;
      sel.dispatchEvent(new Event('input', {bubbles: true}));
      sel.dispatchEvent(new Event('change', {bubbles: true}));
    });

    // Render tıkla
    await page.getByRole('button', {name: 'Render', exact: true}).click();

    // output/project.mp4 oluşana kadar bekle (max 3 dk)
    for (let i = 0; i < 360; i++) {
      if (existsSync(OUT)) { await sleep(1500); break; } // yazımın bitmesi için ufak tampon
      await sleep(500);
    }
    if (!existsSync(OUT)) throw new Error('render produced no mp4');
    console.log('✓ rendered', OUT.pathname);
  } finally {
    await browser.close();
    server.kill();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: package.json'a script ekle**

`render/package.json` `scripts`:
```json
"scripts": {"serve": "vite", "render": "node render-runner.mjs"}
```

- [ ] **Step 3: Render'ı çalıştır (entegrasyon)**

Run: `cd 16-byteflow-engine/render && npm run render`
Expected: `✓ rendered .../output/project.mp4`, exit 0.

- [ ] **Step 4: Çıktıyı doğrulayan test yaz**

`16-byteflow-engine/render/render-runner.test.mjs`:
```js
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const mp4 = fileURLToPath(new URL('./output/project.mp4', import.meta.url));

test('render output exists', () => {
  assert.ok(existsSync(mp4), 'run `npm run render` first');
});

test('render is 1080x1920 h264', () => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name', '-of', 'default=noprint_wrappers=1', mp4]).toString();
  assert.match(out, /width=1080/);
  assert.match(out, /height=1920/);
  assert.match(out, /codec_name=h264/);
});
```

- [ ] **Step 5: Testi çalıştır — PASS bekle**

Run: `cd 16-byteflow-engine/render && node --test render-runner.test.mjs`
Expected: PASS (2 test). (FAIL alırsan render-runner'daki resolution/exporter DOM seçicilerini `page.pause()` ile incele.)

- [ ] **Step 6: Commit**

```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): headless render-runner via playwright"
```

---

### Task 5: Post-process — müzik mux (ffmpeg → final dikey mp4)

**Files:**
- Create: `16-byteflow-engine/publish/post-process.mjs`
- Create: `16-byteflow-engine/assets/music/README.md` (royalty-free müzik notu)
- Modify: `16-byteflow-engine/package.json` (script)
- Test: `16-byteflow-engine/publish/post-process.test.mjs`

**Interfaces:**
- Consumes: `render/output/project.mp4` (sessiz, Task 4), `assets/music/*.mp3`.
- Produces: `dist/final.mp4` (1080×1920, AAC ses). Export: `postProcess({videoPath, musicPath, outPath}) => Promise<string>`.

- [ ] **Step 1: müzik README (asset yeri)**

`16-byteflow-engine/assets/music/README.md`:
```markdown
# Müzik — royalty-free

Buraya Pixabay Music (https://pixabay.com/music/) veya Uppbeat free track'lerini `.mp3`
olarak koy (atıf gerekmez, ticari+sosyal serbest). Post-process ilk `.mp3`'ü kullanır
(ileride rotasyon). Test, dosya yoksa ffmpeg ile sentetik ton üretir.
```

- [ ] **Step 2: post-process.mjs implement et**

`16-byteflow-engine/publish/post-process.mjs`:
```js
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Videoya müziği bindirir: müziği video süresine kırpar, giriş/çıkış fade, video kopyalanır.
export function postProcess({videoPath, musicPath, outPath}) {
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath]).toString().trim());
  const fadeOutStart = Math.max(0, dur - 1.2);
  execFileSync('ffmpeg', [
    '-y', '-i', videoPath, '-stream_loop', '-1', '-i', musicPath,
    '-filter_complex', `[1:a]afade=t=in:st=0:d=0.8,afade=t=out:st=${fadeOutStart}:d=1.2,volume=0.35[a]`,
    '-map', '0:v', '-map', '[a]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(dur), '-shortest', '-movflags', '+faststart', outPath,
  ], {stdio: 'inherit'});
  return outPath;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [video, music, out] = process.argv.slice(2);
  console.log('✓', postProcess({videoPath: video, musicPath: music, outPath: out}));
}
```

- [ ] **Step 3: Failing test yaz**

`16-byteflow-engine/publish/post-process.test.mjs`:
```js
import {test, before} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {postProcess} from './post-process.mjs';

const root = new URL('../', import.meta.url);
const video = fileURLToPath(new URL('render/output/project.mp4', root));
const distDir = fileURLToPath(new URL('dist/', root));
const out = fileURLToPath(new URL('dist/final.mp4', root));
const musicDir = fileURLToPath(new URL('assets/music/', root));
const tone = fileURLToPath(new URL('assets/music/_test_tone.mp3', root));

before(() => {
  mkdirSync(distDir, {recursive: true});
  const mp3 = readdirSync(musicDir).find(f => f.endsWith('.mp3'));
  if (!mp3) {
    // sentetik ton üret
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=30',
      '-c:a', 'libmp3lame', tone]);
  }
});

test('produces final mp4 with audio at 1080x1920', () => {
  assert.ok(existsSync(video), 'render first');
  const mp3 = readdirSync(musicDir).find(f => f.endsWith('.mp3'));
  postProcess({videoPath: video, musicPath: fileURLToPath(new URL(mp3, 'file://' + musicDir + '/')), outPath: out});
  assert.ok(existsSync(out));
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'stream=codec_type,width,height', '-of', 'default=noprint_wrappers=1', out]).toString();
  assert.match(probe, /width=1080/);
  assert.match(probe, /height=1920/);
  assert.match(probe, /codec_type=audio/);
});
```

- [ ] **Step 4: Testi çalıştır — PASS bekle**

Run: `cd 16-byteflow-engine && node --test publish/post-process.test.mjs`
Expected: PASS. `dist/final.mp4` oluşur, ses + 1080×1920.

- [ ] **Step 5: Commit**

```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): ffmpeg music post-process"
```

---

### Task 6: Uçtan uca orkestrasyon (spec → render → müzik → final)

**Files:**
- Create: `16-byteflow-engine/build.mjs`
- Modify: `16-byteflow-engine/package.json` (script)
- Create: `16-byteflow-engine/README.md`

**Interfaces:**
- Consumes: `validateSpec` (Task 1), render-runner (Task 4), `postProcess` (Task 5).
- Produces: `dist/final.mp4`. CLI: `node build.mjs [specPath]` (default `scene-spec.example.json`).

- [ ] **Step 1: build.mjs implement et**

`16-byteflow-engine/build.mjs`:
```js
import {execFileSync} from 'node:child_process';
import {readFileSync, copyFileSync, mkdirSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validateSpec} from './brain/validate.mjs';
import {postProcess} from './publish/post-process.mjs';

const root = new URL('./', import.meta.url);
const specPath = process.argv[2] ?? fileURLToPath(new URL('scene-spec.example.json', root));

// 1. Doğrula
const spec = JSON.parse(readFileSync(specPath));
const {valid, errors} = validateSpec(spec);
if (!valid) { console.error('✗ invalid spec:\n' + errors.join('\n')); process.exit(1); }
console.log('✓ spec valid:', spec.title);

// 2. render'a kopyala
copyFileSync(specPath, fileURLToPath(new URL('render/scene-spec.json', root)));

// 3. render (sessiz mp4)
execFileSync('npm', ['run', 'render'], {cwd: fileURLToPath(new URL('render/', root)), stdio: 'inherit', shell: true});

// 4. müzik seç + post-process
const musicDir = fileURLToPath(new URL('assets/music/', root));
const mp3 = readdirSync(musicDir).find(f => f.endsWith('.mp3') && !f.startsWith('_'));
if (!mp3) { console.error('✗ assets/music içine bir .mp3 koy'); process.exit(1); }
mkdirSync(fileURLToPath(new URL('dist/', root)), {recursive: true});
const out = postProcess({
  videoPath: fileURLToPath(new URL('render/output/project.mp4', root)),
  musicPath: musicDir + '/' + mp3,
  outPath: fileURLToPath(new URL('dist/final.mp4', root)),
});
console.log('✓ done:', out);
```

- [ ] **Step 2: package.json script**

Kök `scripts`:
```json
"scripts": {"test": "node --test", "validate": "node brain/validate.mjs scene-spec.example.json", "build": "node build.mjs"}
```

- [ ] **Step 3: Gerçek müzik ekle**

`assets/music/` içine Pixabay'den 1 royalty-free `.mp3` indir/koy (isim `_` ile başlamasın).

- [ ] **Step 4: Uçtan uca çalıştır**

Run: `cd 16-byteflow-engine && npm run build`
Expected: `✓ spec valid` → render → `✓ done: .../dist/final.mp4`.

- [ ] **Step 5: Final doğrulama (verification-before-completion)**

Run: `ffprobe -v error -show_entries format=duration:stream=codec_type,width,height -of default=noprint_wrappers=1 16-byteflow-engine/dist/final.mp4`
Expected: `width=1080`, `height=1920`, hem `codec_type=video` hem `codec_type=audio`, duration ~10-18s.
Ayrıca `dist/final.mp4`'ten bir kare çıkar ve göz kontrolü yap (BYTEFLOW intro/outro + akan diyagram).

- [ ] **Step 6: README + commit**

`16-byteflow-engine/README.md`: amaç, `npm run build` kullanımı, `scene-spec` formatı özeti, "Faz 2 (Gemini beyni) ve Faz 3 (Graph API yayın) sonra" notu.
```bash
cd 16-byteflow-engine && git add -A && git commit -m "feat(byteflow): end-to-end phase-1 pipeline + readme"
```

---

## Self-Review Notları
- **Spec coverage:** Faz 1 kapsamı (generic şablon, scene-spec sözleşmesi, dikey+müzik uçtan uca video) Task 1-6 ile tam karşılanıyor. Faz 2 (fetch/Gemini) ve Faz 3 (Graph API/cron) bilinçli olarak DIŞARIDA — ayrı planlar.
- **Kritik risk:** Task 4 render-runner'daki DOM seçicileri (resolution input'ları, exporter select) Motion Canvas 3.17 UI'ına bağlı; POC'ta doğrulandı ama sürüm değişirse `page.pause()` ile güncellenmeli.
- **Müzik:** gerçek Pixabay track'i elle eklenir (indirme otomasyonu kırılgan/telif riskli olduğu için plana konmadı); test sentetik ton ile pipeline'ı bağımsız doğrular.
