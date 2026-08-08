import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planSegments, planKinetik, kinetikDim, xfadeChain, normalizeClip, composeFootageVideo, adaptDim, measureLuma, XF} from './compose-footage.mjs';

const recorder = () => {
  const calls = [];
  return {calls, run: (bin, args) => calls.push({bin, args: args.map(String)})};
};
const argOf = (call, flag) => call.args[call.args.indexOf(flag) + 1];

test('planSegments preserves total duration through the xfade overlaps', () => {
  for (const [total, n] of [[27, 4], [18.5, 3], [31, 2], [22, 1]]) {
    const {durations} = planSegments({total, clipCount: n});
    const visible = durations.reduce((a, b) => a + b, 0) - (durations.length - 1) * XF;
    assert.ok(Math.abs(visible - total) < 0.001, `${total}s / ${n} klip → ${visible}`);
  }
});

test('b-roll only bookends the video — the teaching body gets a designed surface', () => {
  const {durations, dims, kinds} = planSegments({total: 28, clipCount: 4});
  assert.deepEqual(kinds, ['clip', 'surface', 'clip'], 'gövdede gerçek görüntü olmamalı');
  assert.ok(durations[1] > durations[0] + durations[2], 'gövde videonun ağırlığı olmalı');
  assert.ok(dims[1] > 0.8, 'gövde zemini metinle yarışmayacak kadar sakin');
  assert.ok(dims[0] < dims[1] && dims[2] < dims[1], 'açılış/kapanış görüntüsü gövdeden açık');
  assert.ok(dims[0] >= 0.4, 'hook yazısı parlak klipte kaybolmasın');
});

test('planSegments keeps the hook and outro readable footage moments', () => {
  const {dims} = planSegments({total: 27, clipCount: 4});
  assert.equal(dims.length, 3);
  assert.ok(dims[0] < 0.6, 'hook footage hâlâ görünür');
  assert.ok(dims[2] > dims[0] && dims[2] < 0.6, 'kapanış biraz daha sakin ama görünür');
});

test('planSegments never emits a segment shorter than the transition', () => {
  const {durations} = planSegments({total: 14, clipCount: 4});
  for (const d of durations) assert.ok(d > XF, `segment ${d}s < xfade ${XF}s`);
});

test('normalizeClip crops to 1080x1920, pans, and burns in the scrim', () => {
  const {calls, run} = recorder();
  normalizeClip({src: 'a.mp4', outPath: 'o.mp4', seconds: 6, panDir: 1, dim: 0.62, run});
  const vf = argOf(calls[0], '-vf');
  assert.match(vf, /crop=1080:1920/);
  assert.match(vf, /gblur=sigma=/);
  assert.match(vf, /drawbox=.*black@0\.62/);
  assert.match(vf, /vignette/);
  // Kısa klip 6sn'ye uzasın diye sonsuz loop girişte olmalı.
  assert.deepEqual(calls[0].args.slice(0, 4), ['-y', '-stream_loop', '-1', '-i']);
});

test('normalizeClip pans a different direction per index', () => {
  const vfs = [0, 1, 2, 3].map(panDir => {
    const {calls, run} = recorder();
    normalizeClip({src: 'a.mp4', outPath: 'o.mp4', seconds: 5, panDir, run});
    return argOf(calls[0], '-vf');
  });
  assert.equal(new Set(vfs).size, 4, 'her yön farklı bir kamera hareketi üretmeli');
});

test('xfadeChain offsets each transition at the end of the running segment', () => {
  const {calls, run} = recorder();
  xfadeChain({clips: ['0.mp4', '1.mp4', '2.mp4'], durations: [4, 10, 6], outPath: 'bg.mp4', run});
  const fc = argOf(calls[0], '-filter_complex');
  const offsets = [...fc.matchAll(/offset=([\d.]+)/g)].map(m => Number(m[1]));
  assert.deepEqual(offsets, [4 - XF, 4 + 10 - 2 * XF]);
  assert.match(fc, /xfade=transition=/);
});

test('xfadeChain copies straight through for a single clip', () => {
  const {calls, run} = recorder();
  xfadeChain({clips: ['only.mp4'], durations: [20], outPath: 'bg.mp4', run});
  assert.ok(calls[0].args.includes('copy'));
});

test('composeFootageVideo reuses clips across segments and overlays the alpha frames', () => {
  const {calls, run} = recorder();
  composeFootageVideo({
    clips: [{path: 'c0.mp4'}, {path: 'c1.mp4'}], kinetik: false,
    framesDir: '/frames', frames: 1620, tmpDir: '/tmp/x', outPath: 'out.mp4', run,
  });
  // 2 klip → planSegments 2 segment ister; her segment normalize edilir.
  const normalizes = calls.filter(c => c.args.includes('-stream_loop'));
  assert.equal(normalizes.length, 2);
  assert.deepEqual(normalizes.map(c => argOf(c, '-i')), ['c0.mp4', 'c1.mp4']);

  const overlay = calls.at(-1);
  assert.match(argOf(overlay, '-filter_complex'), /overlay=0:0/);
  assert.ok(overlay.args.includes('/frames/%06d.png'));
  assert.equal(argOf(overlay, '-t'), '27.00');            // 1620 kare / 60fps
  assert.equal(argOf(overlay, '-start_number'), '0');     // MC kareleri 000000'dan başlar
});

test('composeFootageVideo falls back to a moving gradient when no clip downloaded', () => {
  const {calls, run} = recorder();
  composeFootageVideo({
    clips: [], framesDir: '/frames', frames: 600, tmpDir: '/tmp/x',
    outPath: 'out.mp4', accent: '#bc8cff', run,
  });
  const lavfi = calls.find(c => c.args.includes('lavfi'));
  assert.ok(lavfi, 'klip yoksa üretilmiş hareketli arka plan olmalı');
  assert.match(argOf(lavfi, '-i'), /gradients=.*0xbc8cff.*speed=/);
});

test('findFramesDir locates the PNG directory even when MC nests it', async () => {
  const {mkdtempSync, mkdirSync, writeFileSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {findFramesDir} = await import('./compose-footage.mjs');
  const root = mkdtempSync(join(tmpdir(), 'bf-frames-'));
  const nested = join(root, 'project', 'explainer');
  mkdirSync(nested, {recursive: true});
  writeFileSync(join(nested, '000000.png'), 'x');
  assert.equal(findFramesDir(root), nested);
  assert.equal(findFramesDir(join(root, 'nope')), null);
});

test('adaptDim lifts the scrim on dark clips and leaves bright ones alone', () => {
  assert.equal(adaptDim(0.52, null), 0.52, 'ölçüm yoksa dokunma');
  assert.equal(adaptDim(0.52, 200), 0.52, 'parlak klip aynen kalır');
  assert.ok(adaptDim(0.52, 20) < 0.35, 'çok koyu klipte scrim hafifler');
  assert.ok(adaptDim(0.52, 40) < 0.52 && adaptDim(0.52, 40) > adaptDim(0.52, 20));
  assert.equal(adaptDim(0.44, 80), 0.44, 'orta-parlak klipte karartma DÜŞMEZ (yazı kaybolmasın)');
});

test('measureLuma averages the sampled YAVG values and survives a probe failure', () => {
  const out = 'lavfi.signalstats.YAVG=10.0\nlavfi.signalstats.YAVG=30.0\n';
  assert.equal(measureLuma('x.mp4', () => out), 20);
  assert.equal(measureLuma('x.mp4', () => 'no metadata here'), null);
  assert.equal(measureLuma('x.mp4', () => { throw new Error('ffmpeg yok'); }), null);
});

test('composeFootageVideo applies the adapted scrim to a dark clip', () => {
  const {calls, run} = recorder();
  composeFootageVideo({
    clips: [{path: 'dark.mp4'}], framesDir: '/f', frames: 600, tmpDir: '/tmp/x',
    outPath: 'out.mp4', run, probe: () => 'lavfi.signalstats.YAVG=15.0\n',
    writeList: () => {},
  });
  const vf = argOf(calls.find(c => c.args.includes('-stream_loop')), '-vf');
  const dim = Number(vf.match(/black@([\d.]+)/)[1]);
  assert.ok(dim < 0.44, `koyu klipte scrim düşmeliydi, ${dim} kaldı`);
});

// ─── KİNETİK ZEMİN ───────────────────────────────────────────────────────────
// Ölçülen sorun: eski düzende gövde tek bir 'surface' segmentiydi → canlı kare %1,
// en uzun donuk 12,6s. Bu testler o düzenin geri gelmesini engelliyor.

test('planKinetik videonun TAMAMINI kısa segmentlere böler — tek uzun gövde yok', () => {
  for (const total of [18, 20, 22, 31]) {
    const {durations} = planKinetik({total, clipCount: 2});
    const toplam = durations.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(toplam - total) < 0.06, `${total}s → ${toplam}`);
    assert.ok(Math.max(...durations) <= 2.6,
      `en uzun segment ${Math.max(...durations)}s — gövde yine donuklaşır`);
    // 20s'de en az 9 segment: ~2s'de bir kesme.
    assert.ok(durations.length >= Math.floor(total / 2.4), `${total}s için ${durations.length} segment az`);
  }
});

test('planKinetik açılışı rampalar — ilk kesme 1,2s sınırının altında', () => {
  const {durations} = planKinetik({total: 20, clipCount: 2});
  assert.ok(durations[0] < 1.2,
    `ilk segment ${durations[0]}s — açılış donukluğu sınırı 1,2s (retansiyon-denetci)`);
  assert.ok(durations[1] < durations[2], 'ritim rampalı olmalı: hızlı başla, sonra otur');
});

test('planKinetik aynı klibi tekrar kullanırken YÖN ve BAŞLANGIÇ ANINI değiştirir', () => {
  const {clipIdx, panDirs, seeks} = planKinetik({total: 20, clipCount: 2});
  // Aynı klibe düşen ardışık segmentlerin yönü/anı farklı olmalı, yoksa kesme okunmaz.
  for (let i = 2; i < clipIdx.length; i++) {
    if (clipIdx[i] === clipIdx[i - 2]) {
      assert.notEqual(`${panDirs[i]}|${seeks[i]}`, `${panDirs[i - 2]}|${seeks[i - 2]}`,
        `segment ${i} ile ${i - 2} birebir aynı kadraj`);
    }
  }
});

test('planKinetik kırıntı segment bırakmaz', () => {
  const {durations} = planKinetik({total: 20.3, clipCount: 3});
  assert.ok(Math.min(...durations) >= 0.6, `kırıntı segment: ${Math.min(...durations)}s`);
});

test('kinetik composeFootageVideo SERT kesme kullanır — xfade yok', () => {
  const {calls, run} = recorder();
  const yazilan = [];
  composeFootageVideo({
    clips: [{path: 'c0.mp4'}, {path: 'c1.mp4'}],
    framesDir: '/frames', frames: 1200, tmpDir: '/tmp/x', outPath: 'out.mp4', run,
    writeList: (p, b) => yazilan.push([p, b]),
  });
  const normalizes = calls.filter(c => c.args.includes('-stream_loop'));
  assert.ok(normalizes.length >= 9, `20s için ${normalizes.length} segment az`);
  // Hiçbir çağrıda xfade olmamalı: 0,8s geçiş kesmeyi sıvayıp olay sinyalini yok ediyor.
  assert.ok(!calls.some(c => JSON.stringify(c.args).includes('xfade')), 'kinetik düzende xfade olmamalı');
  assert.ok(calls.some(c => c.args.includes('concat')), 'sert kesme concat ile yapılır');
  assert.equal(yazilan.length, 1, 'concat listesi yazılmalı');
  assert.match(yazilan[0][1], /kseg0\.mp4/);
});

test('kinetik zemin belirgin hareket ve AZ karartma kullanır', () => {
  const {calls, run} = recorder();
  composeFootageVideo({
    clips: [{path: 'c0.mp4'}], framesDir: '/frames', frames: 1200,
    tmpDir: '/tmp/x', outPath: 'out.mp4', run, writeList: () => {},
  });
  const vf = argOf(calls.find(c => c.args.includes('-stream_loop')), '-vf');
  // Eski gövde: black@0.88 + sigma 26 → ekran neredeyse siyah, hareket görünmüyordu.
  const dim = Number(/black@([\d.]+)/.exec(vf)[1]);
  const sigma = Number(/gblur=sigma=([\d.]+)/.exec(vf)[1]);
  assert.ok(dim <= 0.55, `scrim ${dim} — zemin görüntüyü taşıyamaz`);
  assert.ok(sigma <= 12, `blur ${sigma} — detay silinirse hareket de silinir`);
  // Pan payı 1,16'dan büyük olmalı: eski değerde hareket mafd eşiğini geçmiyordu.
  assert.match(vf, /scale=(\d+):(\d+)/);
  const [, sw] = /scale=(\d+):/.exec(vf);
  assert.ok(Number(sw) >= 1080 * 1.25, `pan payı düşük: ${sw}px`);
});

test('klip yoksa kinetik düzen eski gradient yoluna düşer (akış kırılmaz)', () => {
  const {calls, run} = recorder();
  composeFootageVideo({
    clips: [], framesDir: '/frames', frames: 1200, tmpDir: '/tmp/x',
    outPath: 'out.mp4', accent: '#bc8cff', run, writeList: () => {},
  });
  assert.ok(calls.find(c => c.args.includes('lavfi')), 'klip yoksa üretilmiş arka plan olmalı');
});

test('kinetikDim İKİ YÖNLÜ: koyu klipte düşer, PARLAK klipte artar', () => {
  assert.equal(kinetikDim(0.4, null), 0.4, 'ölçüm yoksa dokunma');
  assert.ok(kinetikDim(0.4, 15) < 0.4, 'koyu klipte scrim hafiflemeli');
  assert.equal(kinetikDim(0.4, 70), 0.4, 'orta parlaklıkta değişmemeli');
  // Kinetik biçimde kart yok — beyaz çarşaf kadrajında beyaz yazı kayboluyordu.
  assert.ok(kinetikDim(0.4, 150) > 0.4, `parlak klipte scrim artmalı: ${kinetikDim(0.4, 150)}`);
  assert.ok(kinetikDim(0.4, 110) > 0.4 && kinetikDim(0.4, 110) < kinetikDim(0.4, 150));
  // ⚠ TAVAN DÜŞÜK OLMALI. 0,62'ye kadar çıkabildiğinde (ilk sürüm) gerçek koşuda dört
  // klibin dördü de en üst basamağa düştü ve b-roll görsel olarak yok oldu.
  assert.ok(kinetikDim(0.4, 200) <= 0.52, `scrim tavanı aşıldı: ${kinetikDim(0.4, 200)}`);
  assert.ok(kinetikDim(0.4, 140) < 0.55, 'parlak klip hâlâ görünür kalmalı');
});
