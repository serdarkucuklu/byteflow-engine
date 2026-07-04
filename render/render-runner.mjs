import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {setTimeout as sleep} from 'node:timers/promises';
import {existsSync, rmSync} from 'node:fs';
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

  const browser = await chromium.launch();
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    const page = await browser.newPage();
    page.on('pageerror', err => console.error('[page error]', err.message));
    await page.goto(`http://localhost:${PORT}/`);
    await page.waitForSelector('text=Video Settings', {timeout: 30000});
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

    // The render button gains `data-rendering` while `RendererState.Working`
    // and loses it again once the renderer returns to `Initial` (success,
    // error, or abort) — see @motion-canvas/core Renderer.render(). This is
    // a far more reliable completion signal than polling for the mp4 file:
    // ffmpeg opens/creates the output file as soon as rendering starts and
    // keeps writing to it for the whole render, so "file exists" fires
    // seconds into a render that isn't done yet.
    await page.waitForFunction(
      () => document.querySelector('#render')?.hasAttribute('data-rendering'),
      {timeout: 15000},
    ).catch(() => {
      throw new Error('render did not start (button never entered the rendering state)');
    });

    await page.waitForFunction(
      () => !document.querySelector('#render')?.hasAttribute('data-rendering'),
      {timeout: 5 * 60 * 1000},
    );

    if (!existsSync(OUT_PATH)) {
      throw new Error('renderer finished but produced no mp4 at ' + OUT_PATH);
    }
    console.log('✓ rendered', OUT_PATH);
  } finally {
    await browser.close();
    killServerTree(server);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
