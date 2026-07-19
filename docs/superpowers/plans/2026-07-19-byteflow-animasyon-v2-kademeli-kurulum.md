# ByteFlow Animasyon v2 — Kademeli Kurulum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ByteFlow diyagram sahnelerini "kademeli kurulum" animasyon diline geçir: sistem parça parça kurulur (küçük + çok şekil, sırayla), yazı-üstü-şekil çakışması giderilir, kaybolacak yazı +0.5s fazla kalır, 12 motion preset emekliye ayrılıp tek tutarlı build-up koreografisine geçilir.

**Architecture:** Çekirdek değişim `render/src/scenes/explainer.tsx` diyagram dalında: preset-hook tabanlı "hepsi girer → bağlanır → uçar" yerine, node'ları tek tek açan + her bağlantıyı büyüten + sonra veri akışını oynatan **inline build-up**. 12-preset makinesi (`motion.ts` hook bundle'ları + `motion-registry.mjs` rotasyonu) tek `buildup`'a indirilir. Kod sahnesi (Faz B), persona (C1), hook/takeaway/caption (A) DOKUNULMAZ.

**Tech Stack:** Node 22 ESM, Motion Canvas 3.17.2, Gemini structured output, `node --test`, ffmpeg (render doğrulama).

## Global Constraints

- ESM; beyin/pipeline testleri `*.test.mjs` + `node --test`. Render `render/` içinde TSX (vite).
- `@motion-canvas/*` yalnız `render/` içinde. Render deterministik: **no Math.random/Date.now** (varyasyon deterministik: tema/accent rotasyonu + node sayısı).
- Toplam süre **15-20s** bandında kalır (pacing governor). `pacing.ts`'teki sabit sub-beat'ler explainer koreografisini **aynalamalı** (docstring kuralı) — koreografi değişince pacing sabitleri güncellenir.
- Çakışma kuralı: paket/glow/connector asla label text'in ÜSTÜNDE kalıcı render olmaz. z-sıra: glow < connector < box < label; uçan paket varışta label'ı kapatmadan fade olur.
- CI gotcha'ları (xvfb + RENDER_HEADED=1 + process.exit(0) + dosya-stabilizasyon) DOKUNULMAZ.
- Kaybolacak her yazı (heading, per-step status) fade-out'tan ÖNCE **+0.5s** ekranda tutulur.
- Her render değişikliği gerçek MC render frame'i ile görsel doğrulanır.
- Commit sık; her task sonunda testler yeşil.

---

## File Structure

- `scene-spec.schema.json` (MODIFY) — node `maxItems` 4→6.
- `brain/generate-spec.mjs` (MODIFY) — RESPONSE_SCHEMA node kuralı + prompt "2-5 node".
- `brain/generate-spec.test.mjs` (MODIFY) — gerekirse node-sayısı beklentisi.
- `render/src/lib/spec.ts` (MODIFY) — `boxSize` küçültülür; `layoutPositions` 6 node'a taşmaz.
- `render/src/scenes/explainer.tsx` (MODIFY) — diyagram dalı build-up'a yeniden yazılır; +0.5s holds; overlap fix; preset-hook bağımlılığı kalkar.
- `render/src/lib/pacing.ts` (MODIFY) — build-up beat'lerine göre sabitler retune.
- `render/src/lib/motion-registry.mjs` (MODIFY) — 12 preset → tek `buildup`.
- `render/src/lib/motion.test.mjs` (MODIFY) — yeni gerçeğe göre.
- `render/src/lib/motion.ts` (MODIFY) — 12 hook bundle silinir (kullanılmıyor).
- `run-daily.mjs` (MODIFY) — motion rotasyonu kalkar (spec.motion='buildup').

---

## Task 1: Şema + beyin — 6 node'a kadar

**Files:**
- Modify: `scene-spec.schema.json`
- Modify: `brain/generate-spec.mjs`
- Modify: `brain/generate-spec.test.mjs`

**Interfaces:**
- Produces: diyagram sahnesi 2-6 node taşıyabilir (şema + Gemini). Mevcut 2-4 node spec'ler geçerli kalır.

- [ ] **Step 1: Bump schema maxItems**

`scene-spec.schema.json` içinde diyagram `nodes` tanımında `"maxItems": 4` → `"maxItems": 6`.

- [ ] **Step 2: Verify existing specs still validate**

Run: `npm run validate` → `✓ valid`.
Run (seed'ler): `node -e "import('./brain/validate.mjs').then(async ({validateSpec})=>{const fs=await import('node:fs');const seeds=JSON.parse(fs.readFileSync('brain/seed-backlog.json'));console.log(seeds.every(s=>validateSpec(s).valid)?'SEEDS OK':'FAIL')})"` → `SEEDS OK`.

- [ ] **Step 3: Update the brain prompt + response schema**

`brain/generate-spec.mjs`:
- Prompt kuralı: `2 to 3 nodes per scene` → `2 to 5 nodes per scene (smaller, more numerous is good — the animation builds them up one by one)`.
- RESPONSE_SCHEMA node dizisinde açık bir `maxItems` varsa 6 yap; yoksa (Gemini schema `maxItems` desteklemiyorsa) prompt kuralı yeterli — dokunma.

- [ ] **Step 4: Test**

`brain/generate-spec.test.mjs`'te node sayısına dair katı bir assertion varsa (örn. tam 2-3 bekleyen) güncelle; yoksa yeni test gereksiz. Run: `node --test brain/generate-spec.test.mjs brain/validate.test.mjs brain/produce-spec.test.mjs brain/pillars.test.mjs` → yeşil.

- [ ] **Step 5: Commit**

```bash
git add scene-spec.schema.json brain/generate-spec.mjs brain/generate-spec.test.mjs
git commit -m "feat(spec): allow up to 6 diagram nodes (smaller, more numerous)"
```

---

## Task 2: spec.ts — küçük kutular + 6-node yerleşim

**Files:**
- Modify: `render/src/lib/spec.ts`

**Interfaces:**
- Consumes: `boxSize(layout, count)` / `layoutPositions(layout, count)`. Produces: daha küçük kutular; 6 node canvas'a taşmadan yerleşir.

- [ ] **Step 1: Shrink boxSize**

`render/src/lib/spec.ts` `boxSize` içinde nodes-flow değerlerini küçült ve 5-6 node dalı ekle:

```ts
export function boxSize(layout: string, count: number): {w: number; h: number} {
  if (layout === 'nodes-flow') {
    if (count <= 2) return {w: 360, h: 320};
    if (count === 3) return {w: 280, h: 300};
    if (count === 4) return {w: 220, h: 250};
    return {w: 176, h: 210};           // 5-6 node: küçük tuğlalar
  }
  if (layout === 'vertical-stack') return {w: 560, h: Math.min(220, 1020 / count)};
  return {w: count <= 3 ? 260 : 210, h: 210}; // hub-spoke, cycle
}
```

- [ ] **Step 2: Ensure 6-node layouts don't overflow**

`layoutPositions`/`nodeXPositions` zaten genişlik-farkında (540px kenar guard). 6 node için nodes-flow yatay sığmayabilir → `nodeXPositions` gap hesabı taşmayı zaten clamp'liyor (maxCenter). Gözle doğrula (Step 3 render). Gerekirse nodes-flow 5+ node'da 2-satır sarma YERİNE küçük kutu + sıkı gap yeterli (mevcut clamp korur).

- [ ] **Step 3: Render-verify a 6-node diagram fits**

Geçici 6-node spec yaz + render + son-kare-öncesi bir diyagram karesi çıkar:

```bash
node -e "const fs=require('fs');const s={title:'Six Nodes',hook:'h',takeaway:'t',theme:'#58a6ff',motion:'buildup',caption:'x',hashtags:['#llm'],scenes:[{layout:'nodes-flow',heading:'pipeline',nodes:[{id:'a',icon:'🔤',label:'QUERY'},{id:'b',icon:'🧮',label:'EMBED'},{id:'c',icon:'🗄️',label:'DB'},{id:'d',icon:'🔍',label:'SEARCH'},{id:'e',icon:'📊',label:'RANK'},{id:'f',icon:'🤖',label:'LLM'}],steps:[{from:'a',to:'b',packet:'VEC',color:'accent',status:'embed query'},{from:'c',to:'d',packet:'K=5',color:'good',status:'top-k'},{from:'e',to:'f',packet:'CTX',color:'accent',status:'as context'}]}]};fs.writeFileSync('render/scene-spec.json',JSON.stringify(s,null,2));"
cd render && npm run render
ffmpeg -y -loglevel error -ss 6 -i output/project.mp4 -vframes 1 output/6node.png
```
`render/output/6node.png` Read edilir: 6 kutu canvas içinde, taşma yok, label'lar okunur. Sonra `git checkout render/scene-spec.json render/src/project.meta`.

Not: Bu aşamada explainer hâlâ ESKİ preset koreografisi; sadece boyut/yerleşim kontrolü. Render Playwright ister; çalışmazsa DONE_WITH_CONCERNS + değerleri mantık kontrolü.

- [ ] **Step 4: Commit**

```bash
git add render/src/lib/spec.ts
git commit -m "feat(render): smaller node cards + 5-6 node sizing"
```

---

## Task 3: explainer.tsx — kademeli kurulum koreografisi (ÇEKİRDEK)

**Files:**
- Modify: `render/src/scenes/explainer.tsx` (diyagram dalı)
- Modify: `render/src/lib/pacing.ts` (build-up beat sabitleri)

**Interfaces:**
- Consumes: `layoutPositions`, `boxSize`, `resolveColor`, `COLORS`, `computePacing`/`Pacing`, `connectors()`. Produces: self-contained build-up (preset.enter/drawLines/flight/exit/ambient KULLANMAZ). Kod sahnesi + hook + title + takeaway/Kai outro AYNEN korunur.

- [ ] **Step 1: Import motionTarget directly, drop preset dependency at the top**

`explainer.tsx` başındaki preset kurulumunu değiştir. Mevcut:
```tsx
const preset = resolvePreset((spec as {motion?: string}).motion);
const pacing = computePacing(specShape(spec), motionTarget(preset.weight));
```
Yeni (preset hook'larına gerek yok; build-up sabit hedefle):
```tsx
import {motionTarget} from '../lib/motion-registry.mjs';
// ...
const BUILDUP_WEIGHT = 1;                 // build-up sakin/okunur → ~17.5s hedef
const pacing = computePacing(specShape(spec), motionTarget(BUILDUP_WEIGHT));
```
`resolvePreset` importunu ve `preset.ambient` (satır ~56-57) çağrısını KALDIR (ambient Ken Burns gidiyor; build-up sakin/sabit). `spawn` importu başka yerde kullanılmıyorsa kaldırılabilir (kod sahnesi kullanmıyorsa).

- [ ] **Step 2: Replace the diagram-branch body with progressive build-up**

Diyagram dalında (`if (scene.kind === 'code'...) continue;` sonrası, `const container = ...`'dan itibaren recap+exit'e kadar) gövdeyi şu build-up ile değiştir. Heading fade-in korunur; glow subtle+behind; kutular scale 0 başlar; connector'lar `end:0` başlar.

```tsx
    // ---- Diagram scene: KADEMELİ KURULUM ----
    const container = createRef<Layout>();
    view.add(<Layout ref={container} opacity={1} />);

    const heading = createRef<Txt>();
    container().add(<Txt ref={heading} text={scene.heading ?? ''} fill={ACCENT}
      fontFamily={MONO} fontSize={46} fontWeight={600} letterSpacing={1} y={-540} opacity={0} />);
    yield* heading().opacity(0.95, 0.4);

    const nodes = scene.nodes!;
    const steps = scene.steps!;
    const count = nodes.length;
    const pos = layoutPositions(scene.layout, count);
    const {w, h} = boxSize(scene.layout, count);
    const iconSize = Math.round(h * 0.42);
    const labelSize = Math.min(38, Math.round(w * 0.15));

    // subtle glow behind everything (never over labels)
    container().add(<Rect width={680} height={680} radius={340} fill={ACCENT}
      opacity={0.045} shadowColor={ACCENT} shadowBlur={140} y={0} zIndex={-2} />);

    // connector segments (index pairs) — build toward each new node
    const segs = connectors(scene.layout, count);

    // pre-create boxes (hidden, scale 0) + connector lines (end 0), z-ordered: line < box < label
    const boxes: Record<string, Rect> = {};
    const boxByIndex: Rect[] = [];
    nodes.forEach((n, i) => {
      const box = createRef<Rect>();
      container().add(
        <Rect ref={box} width={w} height={h} radius={26} fill={COLORS.card}
          stroke={COLORS.stroke} lineWidth={3} x={pos[i].x} y={pos[i].y} scale={0} zIndex={1}
          shadowColor={'#00000055'} shadowBlur={24} shadowOffsetY={10}>
          {n.icon ? <Txt text={n.icon} fontSize={iconSize} y={-h * 0.16} /> : null}
          <Txt text={n.label} fill={COLORS.text} fontFamily={MONO} fontSize={labelSize}
            fontWeight={600} letterSpacing={1} y={h * 0.27} />
        </Rect>,
      );
      boxes[n.id] = box();
      boxByIndex[i] = box();
    });
    const lineByTarget = new Map<number, Line[]>();
    segs.forEach(([a, b]) => {
      const ln = createRef<Line>();
      container().add(
        <Line ref={ln} points={[[pos[a].x, pos[a].y], [pos[b].x, pos[b].y]]}
          stroke={COLORS.stroke} lineWidth={4} lineDash={[10, 10]} end={0} zIndex={0} />,
      );
      const tgt = Math.max(a, b);                       // node that "completes" this edge
      (lineByTarget.get(tgt) ?? lineByTarget.set(tgt, []).get(tgt)!).push(ln());
    });

    // status line (below the cluster, never overlapped)
    const status = createRef<Txt>();
    container().add(<Txt ref={status} text="" fill={COLORS.muted}
      fontFamily={MONO} fontSize={40} fontWeight={500} letterSpacing={1} y={600} opacity={0} zIndex={2} />);

    // BUILD PHASE: node 0 in; then for each next node, grow its incoming edges then pop it in.
    yield* boxByIndex[0].scale(1, pacing.enter, easeOutBack);
    for (let i = 1; i < count; i++) {
      const incoming = lineByTarget.get(i) ?? [];
      if (incoming.length) yield* all(...incoming.map(l => l.end(1, pacing.lines, easeOutCubic)));
      yield* boxByIndex[i].scale(1, pacing.enter, easeOutBack);
    }
    // (Her kenarın max(a,b) hedefi ≥1 → flow/hub-spoke/cycle/stack hepsinde her connector
    //  yukarıdaki build döngüsünde hedef node belirince çizilir; ekstra guard'a gerek yok.)

    // DATA PHASE: each step sends one small packet from→to, with status + extra hold.
    for (const step of steps) {
      const from = boxes[step.from], to = boxes[step.to];
      if (!from || !to) continue;
      const col = resolveColor(step.color ?? 'accent', ACCENT);
      const packet = createRef<Rect>();
      container().add(
        <Rect ref={packet} width={104} height={62} radius={16} fill={col}
          x={from.x()} y={from.y()} opacity={0} zIndex={3} shadowColor={col} shadowBlur={22}>
          <Txt text={step.packet} fill={COLORS.bg} fontFamily={MONO} fontSize={26} fontWeight={800} />
        </Rect>,
      );
      yield* all(status().text(step.status), status().fill(col), status().opacity(1, 0.25));
      yield* packet().opacity(1, 0.18);
      yield* all(packet().x(to.x(), pacing.step, easeInOutCubic), packet().y(to.y(), pacing.step, easeInOutCubic));
      yield* all(packet().opacity(0, 0.18), to.stroke(col, 0.2));   // fade BEFORE covering label
      yield* waitFor(pacing.hold + 0.5);                            // +0.5s readability hold
      yield* to.stroke(COLORS.stroke, 0.3);
      packet().remove();
    }

    // brief recap: run the whole flow once as small dots (governed)
    if (pacing.recap > 0 && steps.length > 1) {
      yield* all(status().text('the full flow'), status().fill(ACCENT));
      const dots = steps.map(step => {
        const from = boxes[step.from], to = boxes[step.to];
        if (!from || !to) return null;
        const dot = createRef<Rect>();
        container().add(<Rect ref={dot} width={22} height={22} radius={11} zIndex={3}
          fill={resolveColor(step.color ?? 'accent', ACCENT)} x={from.x()} y={from.y()} opacity={0} />);
        return {dot: dot(), to};
      }).filter(Boolean) as {dot: Rect; to: Rect}[];
      yield* all(...dots.map(d => d.dot.opacity(1, 0.15)));
      yield* all(...dots.map(d => all(d.dot.x(d.to.x(), pacing.recap, easeOutCubic), d.dot.y(d.to.y(), pacing.recap, easeOutCubic))));
      yield* all(...dots.map(d => d.dot.opacity(0, 0.2)));
    }

    // final read-hold (+0.5s) then fade out
    yield* waitFor(pacing.finalDwell + 0.5);
    yield* all(status().opacity(0, 0.3), container().opacity(0, 0.5));
    container().remove();
```

Not: `easeOutBack`, `easeOutCubic`, `easeInOutCubic`, `all`, `waitFor` importları @motion-canvas/core'dan mevcut/eklenir. `zIndex` ile z-sıra garanti (line 0 < box 1 < status 2 < packet 3; glow -2). Paket varışta label'ı kapatmadan fade → çakışma yok.

- [ ] **Step 3: Retune pacing.ts fixed sub-beats to mirror the build-up**

`render/src/lib/pacing.ts` sabitleri build-up'ı aynalamalı. Build-up'ta: her step = paket in(0.18) + flight(step) + out(0.18) + hold+0.5 + stroke-reset(0.3). Scene-fixed: heading(0.4) + node girişleri (count×enter, ama bunlar governed enter değil — build fazı) + container fade(0.5). Güncelle:

```ts
const STEP_FIXED = 0.86;   // paket in 0.18 + out 0.18 + stroke reset 0.3 + +0.5 hold pay(0.2 kısmı hold'a bindi)
// finalDwell +0.5 zaten explainer'da waitFor(finalDwell+0.5) → estimate'e ekle:
```
`estimate`/`estimateTotalSec`/`computePacing` içinde per-scene sabit terimlere build fazı süresini yansıt: build fazı ≈ `count * ENTER + (count-1) * LINES` (node girişleri + connector büyümeleri). Mevcut `scenes * (ENTER + LINES + SCENE_FIXED)` yerine node-sayısı-farkında yap:

```ts
// specShape zaten totalNodes taşıyor → build fazını node sayısıyla ölç.
const fixed = FIXED_SEC
  + shape.totalNodes * ENTER            // her node girişi
  + Math.max(shape.totalNodes - shape.scenes, 0) * LINES  // her ekstra node bir connector büyütür
  + scenes * (SCENE_FIXED + 0.5);       // container fade + heading + final +0.5
```
Ve her step `+0.5` hold taşıdığı için `STEP_FIXED`'i buna göre ayarla. **Kalibrasyon:** Task 3 Step 4 render'ından gerçek süreyi ölç, sabitleri gerçek süre 15-20s bandına oturana dek ayarla (Faz A/B'deki gibi tahmin↔gerçek yakınsat). Testler: `node --test render/src/lib/pacing.test.mjs` yeşil kalmalı (sınır testleri).

- [ ] **Step 4: Render-verify the build-up + measure duration + SHOW frames**

3 senaryo render et ve süreyi ölç (hepsi 15-20s olmalı): (a) 3-node, (b) 6-node, (c) 2-scene karışık.
```bash
# (a) 3-node RAG
node -e "const fs=require('fs');const s={title:'RAG Retrieval',hook:'Cosine similarity isn\\'t understanding.',takeaway:'Retrieval quality beats model size.',theme:'#58a6ff',motion:'buildup',caption:'x',hashtags:['#llm'],scenes:[{layout:'nodes-flow',heading:'retrieval path',nodes:[{id:'q',icon:'❓',label:'QUERY'},{id:'db',icon:'🗄️',label:'VECTOR DB'},{id:'llm',icon:'🤖',label:'LLM'}],steps:[{from:'q',to:'db',packet:'VEC',color:'accent',status:'nearest neighbor'},{from:'db',to:'llm',packet:'CTX',color:'good',status:'top-k as context'}]}]};fs.writeFileSync('render/scene-spec.json',JSON.stringify(s,null,2));"
cd render && npm run render && ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 output/project.mp4
```
Her render'dan bir build-fazı karesi (ör. -ss 3) + bir data-fazı karesi (-ss 7) çıkar, Read et:
- Node'lar sırayla beliriyor (erken karede az, geç karede çok kutu).
- Paket label'ın ÜSTÜNDE kalıcı değil (data karesinde label okunur).
- Süre 15-20s.
Kareler `output/*.png` → Read. Sonra `git checkout render/scene-spec.json render/src/project.meta`.

**Bu task'ın çıktısı kullanıcıya gösterilecek** (controller kareleri kullanıcıya iletir). Render ortam sorunu çıkarsa DONE_WITH_CONCERNS + TSX/pacing tutarlılığı + CI'ya bırak.

- [ ] **Step 5: Commit**

```bash
git add render/src/scenes/explainer.tsx render/src/lib/pacing.ts
git commit -m "feat(render): progressive build-up choreography + overlap fix + 0.5s holds"
```

---

## Task 4: 12 preset → tek build-up (temizlik)

**Files:**
- Modify: `render/src/lib/motion-registry.mjs`
- Modify: `render/src/lib/motion.test.mjs`
- Modify: `render/src/lib/motion.ts`
- Modify: `run-daily.mjs`

**Interfaces:**
- Consumes: Task 3 (explainer artık preset hook kullanmıyor; sadece `motionTarget` registry'den). Produces: tek `buildup` preset; `pickMotion` daima buildup; `run-daily` motion rotasyonu yapmaz.

- [ ] **Step 1: Collapse the registry to a single build-up preset**

`render/src/lib/motion-registry.mjs` `MOTION_META`'yı tek girişe indir:
```js
export const MOTION_META = [
  {name: 'buildup', stagger: 0, weight: 1},
];
```
`MOTION_NAMES`, `pickMotion`, `motionTarget` aynen çalışır (pickMotion daima buildup döner). `motionTarget` değişmez.

- [ ] **Step 2: Update motion.test.mjs to the new reality**

`render/src/lib/motion.test.mjs`:
- `'exactly 12 presets'` testini `'single buildup preset'` yap: `assert.equal(MOTION_META.length, 1); assert.equal(MOTION_NAMES[0], 'buildup')`.
- `'classic exists (fallback preset)'` testini kaldır veya `'buildup exists'`e çevir.
- `pickMotion rotates`/`negative` testlerini tek-girişe göre güncelle: `pickMotion(0).name==='buildup'`, `pickMotion(5).name==='buildup'`, `pickMotion(-1).name==='buildup'`.
- `motionTarget 15-19.5 band` testi aynen kalır (tek weight için).
Run: `node --test render/src/lib/motion.test.mjs` → yeşil.

- [ ] **Step 3: Strip motion.ts of the 12 hook bundles**

`render/src/lib/motion.ts` artık explainer tarafından KULLANILMIYOR (Task 3 kaldırdı). İçindeki 12 HOOKS bundle'ı, flight/enter/exit variant'ları, `MOTION_PRESETS`, `resolvePreset` silinir. Dosya ya tamamen kaldırılır (import eden kimse kalmadıysa — grep ile doğrula: `grep -rn "from './motion'" render/src` ve `resolvePreset`/`MOTION_PRESETS` kullanan yok) ya da `MotionPreset`/`MotionCtx` tipleri başka yerde gerekmiyorsa boşaltılır. **Önce grep ile kullanım doğrula**, kullanılmıyorsa dosyayı sil (`git rm render/src/lib/motion.ts`). `motion-registry.mjs` guard'ı (`for (const m of MOTION_META) if (!HOOKS...)`) motion.ts'te olduğu için o da gider.

- [ ] **Step 4: Update run-daily.mjs — drop motion rotation**

`run-daily.mjs` içinde `pickMotion` importu + `const motion = pickMotion(n).name` + `spec.motion = motion` + history'ye `motion` yazımını sadeleştir: `spec.motion = 'buildup'` sabitle (veya motion alanını tümden kaldır — ama explainer artık motion'a bakmıyor, pacing sabit weight kullanıyor). Güvenli: `spec.motion = 'buildup'` bırak (history okunabilir kalsın), `pickMotion` importunu kaldır. `console.log`'daki `motion` referansını güncelle.

- [ ] **Step 5: Full render + suite verification**

Run: `node --test render/src/lib/motion.test.mjs render/src/lib/pacing.test.mjs render/src/lib/spec.test.mjs brain/*.test.mjs publish/*.test.mjs` → tümü yeşil.
Bir tam pipeline render doğrulaması: Task 3 Step 4'teki 3-node spec'i render et, süre 15-20s, hata yok. `git checkout render/scene-spec.json render/src/project.meta`.

- [ ] **Step 6: Commit**

```bash
git add render/src/lib/motion-registry.mjs render/src/lib/motion.test.mjs run-daily.mjs
git rm render/src/lib/motion.ts   # (kullanılmıyorsa; değilse git add)
git commit -m "refactor(motion): retire 12 presets → single build-up; drop motion rotation"
```

---

## Self-Review Notu

- **Spec kapsamı:** Kademeli kurulum → Task 3; küçük+çok şekil → Task 1 (6 node) + Task 2 (küçük kutu); +0.5s hold → Task 3; çakışma fix → Task 3 (zIndex + varışta fade); 12 preset emekliye → Task 4; timing/band → Task 3 pacing retune. Hepsi karşılandı.
- **Kapsam dışı korunuyor:** kod sahnesi (Faz B), persona/Kai outro (C1), hook/title (A), publish/insights — Task 3 yalnız diyagram dalını değiştirir.
- **Risk:** Task 3 render rewrite en yüksek; render frame doğrulaması + kullanıcı görsel onayı şart. pacing kalibrasyonu gerçek-süre ölçümüyle (tahmin↔gerçek).
- **cycle layout wrap-edge:** `lineByTarget` her kenarı `max(a,b)` hedef node'una bağlar; cycle'ın son→ilk (wrap) kenarı `max=count-1` → node count-1 belirince çizilir. Tüm layout'larda her kenarın hedefi ≥1 olduğundan build döngüsü hepsini kapsar (ekstra guard yok).
- **İçerik genişliği** (model karşılaştırma/RAG/STT/TTS pillar) bu planın DIŞINDA — ayrı iş kolu.
