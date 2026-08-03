// repo-push.sh — ÜRETİLMİŞ VİDEONUN repoya girdiği tek kapı. Buradaki bir hata, Gemini ve
// TTS kotası harcandıktan SONRA işi kaybettiriyor; o yüzden gerçek git depolarıyla sınanıyor.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const SCRIPT = fileURLToPath(new URL('./repo-push.sh', import.meta.url));
const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});

/** Bir "uzak" depo + iki çalışma kopyası: A = koşan iş, B = araya giren başka bir push. */
function kurulum() {
  const kok = mkdtempSync(join(tmpdir(), 'repo-push-'));
  const uzak = join(kok, 'uzak.git');
  mkdirSync(uzak);
  git(uzak, 'init', '--bare', '--initial-branch=master');

  const tohum = join(kok, 'tohum');
  mkdirSync(tohum);
  git(tohum, 'init', '--initial-branch=master');
  git(tohum, 'config', 'user.email', 't@t.t');
  git(tohum, 'config', 'user.name', 't');
  mkdirSync(join(tohum, 'durum'), {recursive: true});
  writeFileSync(join(tohum, 'durum', 'eski-marka.json'), '{"a":1}\n');
  writeFileSync(join(tohum, 'okuma.md'), 'baslangic\n');
  git(tohum, 'add', '-A');
  git(tohum, 'commit', '-m', 'ilk');
  git(tohum, 'remote', 'add', 'origin', uzak);
  git(tohum, 'push', '-u', 'origin', 'master');

  const klon = ad => {
    const d = join(kok, ad);
    git(kok, 'clone', uzak, d);
    git(d, 'config', 'user.email', `${ad}@t.t`);
    git(d, 'config', 'user.name', ad);
    return d;
  };
  return {kok, uzak, a: klon('a'), b: klon('b'), temizle: () => rmSync(kok, {recursive: true, force: true})};
}

const calistir = (cwd, mesaj, ...yollar) =>
  execFileSync('bash', [SCRIPT, mesaj, ...yollar], {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});

test('araya giren push varsa rebase ile yine de iter', () => {
  const {a, b, uzak, temizle} = kurulum();
  try {
    writeFileSync(join(b, 'okuma.md'), 'b yazdi\n');
    git(b, 'commit', '-am', 'b');
    git(b, 'push');

    writeFileSync(join(a, 'video.mp4'), 'ikili-icerik');
    const sha = calistir(a, 'chore: gunluk reel', 'video.mp4').trim().split('\n').pop();
    assert.match(sha, /^[0-9a-f]{40}$/);
    assert.match(git(uzak, 'ls-tree', '-r', '--name-only', 'master'), /video\.mp4/);
  } finally { temizle(); }
});

test('MODIFY/DELETE: yukarı akış dosyayı sildiyse silme kazanır, üretilen dosya yine gider', () => {
  // 2026-08-03 canlı hata: marka yeniden adlandırılırken eski slug'ın durum dosyaları
  // master'da silindi; o sırada koşan iş aynı dosyaları eski checkout'uyla commit'lemişti.
  // Rebase modify/delete'e düştü, script teslim oldu, ÜRETİLEN VİDEO KAYBOLDU.
  const {a, b, uzak, temizle} = kurulum();
  try {
    git(b, 'rm', '-q', 'durum/eski-marka.json');
    git(b, 'commit', '-m', 'olu markayi sil');
    git(b, 'push');

    // A hâlâ eski checkout'ta: aynı dosyayı değiştiriyor ve videoyu üretiyor.
    writeFileSync(join(a, 'durum', 'eski-marka.json'), '{"a":2}\n');
    writeFileSync(join(a, 'video.mp4'), 'ikili-icerik');
    const sha = calistir(a, 'chore: gunluk reel', 'video.mp4', 'durum').trim().split('\n').pop();
    assert.match(sha, /^[0-9a-f]{40}$/, 'push başarılı olmalı');

    const agac = git(uzak, 'ls-tree', '-r', '--name-only', 'master');
    assert.match(agac, /video\.mp4/, 'üretilen video uzak depoya gitmeli');
    assert.doesNotMatch(agac, /eski-marka\.json/, 'yukarı akıştaki silme korunmalı (ölü dosya dirilmemeli)');
  } finally { temizle(); }
});

test('itilecek dosya yoksa çıkış yine geçerli bir SHA', () => {
  const {a, temizle} = kurulum();
  try {
    const sha = calistir(a, 'chore: bos', 'olmayan-dosya.mp4').trim().split('\n').pop();
    assert.match(sha, /^[0-9a-f]{40}$/);
  } finally { temizle(); }
});
