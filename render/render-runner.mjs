import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {setTimeout as sleep} from 'node:timers/promises';
import {existsSync, rmSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const PORT = 9000;
const OUT = new URL('./output/project.mp4', import.meta.url);
const OUT_PATH = fileURLToPath(OUT);

async function waitForServer(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error('dev server did not start');
}

// On Windows, `spawn('npm', ..., {shell: true})` returns the PID of the
// wrapping cmd.exe. A plain `child.kill()` only kills that shell and leaves
// the real vite/node process (and any ffmpeg child it spawned) running,
// which both orphans processes and keeps holding port 9000 / the output
// file lock. `taskkill /T /F` kills the whole descendant tree instead.
function killServerTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {stdio: 'ignore'});
  } else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

async function main() {
  if (existsSync(OUT_PATH)) {
    try {
      rmSync(OUT_PATH);
    } catch (e) {
      throw new Error(`could not remove stale ${OUT_PATH} (still locked by a previous render?): ${e.message}`);
    }
  }

  const server = spawn('npm', ['run', 'serve'], {
    cwd: new URL('.', import.meta.url),
    shell: true,
  });
  server.stdout.on('data', d => process.stdout.write(`[vite] ${d}`));
  server.stderr.on('data', d => process.stderr.write(`[vite] ${d}`));

  // Headless chromium'da Motion Canvas editör UI + canvas/ffmpeg render'ı takılıyor
  // (CI'da kanıtlandı). RENDER_HEADED=1 ise (xvfb sanal ekranı altında) headed başlat.
  // Anti-throttle flag'ler: arka plandaki pencerede requestAnimationFrame/timer
  // throttle'ını kapat — yoksa hem MC render loop'u hem waitForFunction rAF polling'i durur.
  const browser = await chromium.launch({
    headless: process.env.RENDER_HEADED !== '1',
    args: [
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    const page = await browser.newPage();
    page.on('pageerror', err => console.error('[page error]', err.message));
    await page.goto(`http://localhost:${PORT}/`, {waitUntil: 'domcontentloaded'});
    // CI'da ilk vite derlemesi + editör mount yavaş olabilir → 90s.
    await page.waitForSelector('text=Video Settings', {timeout: 90000});
    // Editor mounts its reactive settings a beat after the panel label appears.
    await sleep(1000);

    // ---- Resolution: 1080x1920 (vertical) ----
    // The two resolution fields are the 3rd/4th `input[type=number]` in the
    // panel (index 0/1 are the preview range start/end). Using Playwright's
    // `.fill()` (real focus/type/blur) is required here: dispatching raw
    // `input`/`change` events via the native value setter is unreliable —
    // in testing it silently failed to update the width field while the
    // height field appeared to update (a signals-reactivity quirk in the
    // Motion Canvas UI, not something to route around by lowering fidelity).
    const numberInputs = page.locator('input[type=number]');
    await numberInputs.nth(2).fill('1080'); // width
    await sleep(200);
    await numberInputs.nth(3).fill('1920'); // height
    await sleep(200);

    const [width, height] = await numberInputs.evaluateAll(
      (els, [wi, hi]) => [els[wi].value, els[hi].value],
      [2, 3],
    );
    if (width !== '1080' || height !== '1920') {
      throw new Error(`resolution did not apply: got width=${width} height=${height}`);
    }

    // ---- Exporter: Video (FFmpeg) ----
    const exporterHandle = await page.evaluateHandle(() =>
      [...document.querySelectorAll('select')].find(s =>
        [...s.options].some(o => /ffmpeg/i.test(o.textContent)),
      ),
    );
    const exporterSelect = exporterHandle.asElement();
    if (!exporterSelect) throw new Error('could not find the FFmpeg exporter <select>');
    await exporterSelect.selectOption({label: 'Video (FFmpeg)'});
    await sleep(300);

    // ---- Render ----
    const renderBtn = page.locator('#render');
    await renderBtn.click();

    // Render'ın BAŞLADIĞINI doğrula (data-rendering ekleniyor). polling:'raf' yerine
    // sabit aralıkla poll et — headed/xvfb'de rAF throttle olabilir.
    await page.waitForFunction(
      () => document.querySelector('#render')?.hasAttribute('data-rendering'),
      {timeout: 30000, polling: 1000},
    ).catch(() => {
      throw new Error('render did not start (button never entered the rendering state)');
    });

    // Tamamlanmayı DOM yerine DOSYA-STABİLİZASYONU ile bekle (editörden bağımsız,
    // rAF'a bağımsız): ffmpeg render boyunca mp4'e yazar; boyut STABLE_MS boyunca
    // değişmiyorsa render bitmiştir.
    const STABLE_MS = 3000, MAX_MS = 6 * 60 * 1000, STEP = 1000;
    let lastSize = -1, stableFor = 0, elapsed = 0;
    while (elapsed < MAX_MS) {
      await sleep(STEP);
      elapsed += STEP;
      const size = existsSync(OUT_PATH) ? statSync(OUT_PATH).size : -1;
      const rendering = await page.evaluate(
        () => document.querySelector('#render')?.hasAttribute('data-rendering'),
      ).catch(() => true);
      if (size > 0 && size === lastSize) {
        stableFor += STEP;
        if (stableFor >= STABLE_MS && !rendering) break;
      } else {
        stableFor = 0;
      }
      lastSize = size;
    }
    if (!existsSync(OUT_PATH) || statSync(OUT_PATH).size === 0) {
      throw new Error('render tamamlanmadı / mp4 üretilmedi: ' + OUT_PATH);
    }
    console.log('✓ rendered', OUT_PATH, `(${statSync(OUT_PATH).size} bytes)`);
  } finally {
    await browser.close();
    killServerTree(server);
  }
}

// main() sonrası process.exit(0) ŞART: Linux'ta killServerTree vite'ı grup olarak
// öldüremediğinden (detached değil) event loop açık kalır ve node çıkmaz → execFileSync
// sonsuz bekler (CI'da 20dk timeout'a kadar takıldı). Explicit exit bunu keser.
main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
