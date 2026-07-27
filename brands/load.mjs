// Marka yükleyici — motoru TEK sayfaya bağlı olmaktan çıkarır.
//
// Neden: @byteflowlabs 12 yerde, pillar'lar/feed'ler/seed'ler/persona kodun içindeydi.
// Aynı altyapıyla başka nişlerde sayfa açmak (Serdar'ın isteği) her seferinde kod
// çatallamak demekti. Artık yeni sayfa = brands/<slug>.json + kendi secret'ları.
//
// Sözleşme: marka dosyası SADECE veri taşır (kimlik, ton, konu havuzu, kaynaklar, durum
// dosyaları, secret ADLARI). Sır asla dosyada durmaz — env değişkeninin adı durur.
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BRANDS_DIR = join(ROOT, 'brands');

const REQUIRED = ['slug', 'handle', 'persona', 'pillarSet', 'feedSet'];

export function listBrands() {
  if (!existsSync(BRANDS_DIR)) return [];
  return readdirSync(BRANDS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace(/\.json$/, ''))
    .sort();
}

/** CLI (--brand=x), env (BYTEFLOW_BRAND) ya da varsayılan 'byteflow'. */
export function resolveBrandSlug(argv = process.argv, env = process.env) {
  const arg = argv.find(a => a.startsWith('--brand='));
  return (arg ? arg.slice('--brand='.length) : env.BYTEFLOW_BRAND) || 'byteflow';
}

export function loadBrand(slug = resolveBrandSlug(), {root = ROOT} = {}) {
  const path = join(root, 'brands', `${slug}.json`);
  if (!existsSync(path)) {
    throw new Error(`marka bulunamadı: ${slug} (mevcut: ${listBrands().join(', ') || 'yok'})`);
  }
  const brand = JSON.parse(readFileSync(path, 'utf8'));
  const missing = REQUIRED.filter(k => !brand[k]);
  if (missing.length) throw new Error(`brands/${slug}.json eksik alan(lar): ${missing.join(', ')}`);

  // Yol alanlarını mutlaklaştır — çağıran her yerden aynı şekilde kullansın.
  const state = brand.state ?? {};
  return {
    ...brand,
    themes: brand.themes?.length ? brand.themes : ['#58a6ff'],
    narrationVoices: brand.narrationVoices?.length ? brand.narrationVoices : ['Kore'],
    paths: {
      history: join(root, state.history ?? `brands/state/${slug}-history.json`),
      spec: join(root, state.spec ?? `brands/state/${slug}-spec.json`),
      seeds: join(root, brand.seedBacklog ?? 'brain/seed-backlog.json'),
      music: join(root, brand.musicDir ?? 'assets/music'),
    },
  };
}

/** Secret ADlarını gerçek değerlere çevirir (değer yoksa undefined döner — çağıran karar verir). */
export function credentials(brand, env = process.env) {
  const map = brand.publish ?? {};
  const read = ref => (ref && typeof ref === 'string' ? env[ref] : undefined);
  return {
    igUserId: read(map.instagram?.userId),
    igToken: read(map.instagram?.token),
    fbPageId: read(map.facebook?.pageId),
    threadsUserId: read(map.threads?.userId),
    threadsToken: read(map.threads?.token),
  };
}
