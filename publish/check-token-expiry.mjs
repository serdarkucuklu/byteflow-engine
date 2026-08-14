// IG token data-access expiry guard (CI). Token kendini debug eder (app secret gerekmez).
// <THRESHOLD gün kaldıysa GitHub Issue açar (GITHUB_TOKEN ile) → kullanıcıya mail gider.
//
// ⚠ 2026-08-14: bekçi yalnız IG_ACCESS_TOKEN'a (@kizlar.kodu) bakıyordu; @cilt.kodu'nun
// NOBLE_IG_TOKEN'ı HİÇ denetlenmiyordu — o token dolduğu gün sayfa sessizce yayın yapamaz,
// bekçi yeşil kalırdı. Değişken adları artık KANONİK kaynaktan türetiliyor
// (brands/*.json → publish.instagram.token), böylece yeni bir marka eklendiğinde bekçi
// ona kör doğmaz.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {listBrands} from '../brands/load.mjs';

const G = 'https://graph.facebook.com/v21.0';
const THRESHOLD_DAYS = 14;
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Marka dosyalarından tekilleştirilmiş token değişkeni listesi: [{env, markalar[]}] */
function tokenDegiskenleri() {
  const harita = new Map();
  for (const slug of listBrands()) {
    let brand;
    try {
      brand = JSON.parse(readFileSync(join(ROOT, 'brands', `${slug}.json`), 'utf8'));
    } catch { continue; }
    const env = brand.publish?.instagram?.token;
    if (!env) continue;
    if (!harita.has(env)) harita.set(env, []);
    harita.get(env).push(brand.handle || slug);
  }
  return [...harita].map(([env, markalar]) => ({env, markalar: markalar.join(', ')}));
}

async function issueAc({env, markalar, daysLeft, dateStr}) {
  const gh = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
  if (!gh || !repo) { console.log(`::warning::${env} ${daysLeft}g kaldı ama GITHUB_TOKEN yok, issue açılamadı`); return; }
  const api = `https://api.github.com/repos/${repo}/issues`;
  const hdr = {Authorization: `Bearer ${gh}`, Accept: 'application/vnd.github+json', 'User-Agent': 'byteflow-bot'};
  // Başlık DEĞİŞKEN ADINI taşır: iki markanın token'ı aynı anda dolarken tek issue açılıp
  // ikincisi sessizce yutulmasın.
  const title = `ByteFlow: Instagram token yenilenmeli ⚠️ (${env})`;
  const existing = await (await fetch(`${api}?state=open`, {headers: hdr})).json();
  if (Array.isArray(existing) && existing.some(i => i.title === title)) {
    console.log(`::warning::${env} için yenileme issue'ı zaten açık`); return;
  }
  await fetch(api, {method: 'POST', headers: hdr, body: JSON.stringify({
    title,
    body: `**${markalar}** sayfasının Instagram token'ı (\`${env}\`) ~${daysLeft} gün içinde (**${dateStr}**) data-access erişimini kaybedecek. O tarihten sonra bu sayfada oto-post durur.\n\n**Yenileme:**\n1. Graph API Explorer → app \`1550391679860216\` → \`instagram_content_publish\` işaretle → Generate Access Token\n2. Kısa token'ı page token'a çevir (repo'daki \`scratchpad/ig-setup.mjs\` mantığı / \`fb_exchange_token\` + \`/me/accounts\`)\n3. Repo → Settings → Secrets → **${env}**'ı güncelle\n\n**Kalıcı çözüm (bir kere kur, bir daha uğraşma):** Meta Business Suite → Business Settings → System Users → \`instagram_content_publish\`+pages izinli **System User token** üret (hiç expire olmaz) → \`${env}\`'a koy.`,
  })});
  console.log(`::warning::${env} (${markalar}) ${daysLeft} gün kaldı — yenileme issue'ı açıldı`);
}

/** Tek token'ın hükmü: 'gecersiz' | 'belirsiz' | 'ok'. */
async function tokenDenetle({env, markalar}) {
  const t = process.env[env];
  if (!t) {
    // Sessiz geçme: secret bağlanmamışsa yayın da yapılamaz, bunu görmek isteriz.
    console.log(`::warning::${env} (${markalar}) tanımlı değil — denetlenemedi`);
    return 'belirsiz';
  }
  const dbg = await (await fetch(`${G}/debug_token?input_token=${t}&access_token=${t}`)).json();
  // GERÇEK geçersizlik (is_valid=false) → hata + exit 1. Ama debug_token'ın kendisi GEÇİCİ
  // bir Graph hatası (kod 1/2/4… "retry later") döndürdüyse token durumu BELİRSİZ'dir —
  // yanlış "token geçersiz" alarmı verme (2026-07-19: transient kod-2 blip'i böyle yanlış teşhis edildi).
  if (dbg.data?.is_valid === false) {
    console.log(`::error::${env} (${markalar}) GERÇEKTEN geçersiz (is_valid=false) — yenilenmeli.`);
    return 'gecersiz';
  }
  if (dbg.error) {
    // ⚠ Kod 190 (OAuthException) GEÇİCİ DEĞİLDİR: token süresi dolmuş, iptal edilmiş ya da
    // hiç ayrıştırılamıyor demektir — ve debug_token bu durumda `data` bile döndürmediği
    // için is_valid kontrolü onu HİÇ görmüyordu. Bekçi tam da korumakla görevli olduğu anda
    // susuyordu. Yalnız 190 hüküm verir; diğer kodlar (1/2/4… "retry later") belirsizdir
    // (2026-07-19: transient kod-2 blip'i yanlış teşhis edilmişti).
    if (dbg.error.code === 190) {
      console.log(`::error::${env} (${markalar}) GEÇERSİZ (kod 190: ${dbg.error.message}) — yenilenmeli.`);
      return 'gecersiz';
    }
    console.log(`::warning::${env} durumu doğrulanamadı (geçici Graph hatası ${dbg.error.code}: ${dbg.error.message}) — alarm atlanıyor`);
    return 'belirsiz';
  }
  const exp = dbg.data?.data_access_expires_at;
  if (!exp) { console.log(`::notice::${env} data-access expiry raporlamadı, OK`); return 'ok'; }

  const daysLeft = Math.round((exp * 1000 - Date.now()) / 86400000);
  const dateStr = new Date(exp * 1000).toISOString().slice(0, 10);
  console.log(`${env} (${markalar}): ${daysLeft} gün kaldı (data access ${dateStr})`);
  if (daysLeft > THRESHOLD_DAYS) { console.log(`::notice::${env} OK`); return 'ok'; }
  await issueAc({env, markalar, daysLeft, dateStr});
  return 'ok';
}

const degiskenler = tokenDegiskenleri();
if (!degiskenler.length) {
  console.log('::warning::hiçbir markada publish.instagram.token tanımlı değil — denetlenecek token yok');
  process.exit(0);
}
console.log(`denetlenecek token(lar): ${degiskenler.map(d => d.env).join(', ')}`);

// Bir token'ın geçersizliği DİĞERİNİN denetimini iptal etmemeli: hepsi koşar, hüküm sonda.
const hukumler = [];
for (const d of degiskenler) hukumler.push(await tokenDenetle(d));
if (hukumler.includes('gecersiz')) process.exit(1);
