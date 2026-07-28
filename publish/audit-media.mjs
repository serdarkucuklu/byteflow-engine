// SALT OKUNUR denetim: sayfada canlı ne var? Açıklama, etiketler ve YORUMLAR dahil.
//
// Neden: yayın hattı otomatik ve hatalar yayına çıktıktan sonra fark ediliyor
// (2026-07-28: cilt bakımı sayfasının gönderisinde AI etiketleri, ilk yorumda AI etiketleri).
// Yorumlar açıklamadan ayrı bir yüzey — spec'e bakarak göremiyorsun, hesaba bakmak gerekiyor.
//
// Kullanım: BYTEFLOW_BRAND=ciltkodu node publish/audit-media.mjs [adet]
import {loadBrand, credentials} from '../brands/load.mjs';

const G = 'https://graph.facebook.com/v21.0';
const brand = loadBrand();
const cred = credentials(brand);
if (!cred.igUserId || !cred.igToken) throw new Error(`${brand.slug}: Instagram secret'ları eksik`);

const limit = Number(process.argv[2] ?? 10);
const q = async url => {
  const r = await fetch(url);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j;
};

const media = await q(`${G}/${cred.igUserId}/media?fields=id,media_type,permalink,timestamp,caption&limit=${limit}&access_token=${cred.igToken}`);
console.log(`▣ ${brand.slug} ${brand.handle} — ${media.data.length} gönderi\n`);

for (const m of media.data) {
  const caption = m.caption ?? '';
  const tags = [...caption.matchAll(/#[\p{L}0-9_]+/gu)].map(x => x[0]);
  console.log('━'.repeat(60));
  console.log(`${m.timestamp}  [${m.media_type}]  ${m.id}`);
  console.log(`  ${m.permalink}`);
  console.log(`  BAŞLIK  : ${caption.split('\n')[0].slice(0, 90)}`);
  console.log(`  ETİKET  : ${tags.join(' ') || '(yok)'}`);
  // Yanlış marka imzası ancak TAM açıklamada görülüyor (2026-07-28: cilt sayfasının
  // gönderisinde "@byteflowlabs" imzası vardı — ilk satıra bakarak fark edilmiyordu).
  const foreign = [...caption.matchAll(/@[A-Za-z0-9._]+/g)].map(x => x[0])
    .filter(h => h.toLowerCase() !== brand.handle.toLowerCase());
  console.log(`  AÇIKLAMA:\n${caption.split('\n').map(l => '    | ' + l).join('\n')}`);
  if (foreign.length) console.log(`  ⚠ YABANCI HESAP ADI: ${[...new Set(foreign)].join(' ')}`);

  try {
    const cm = await q(`${G}/${m.id}/comments?fields=id,text,timestamp&access_token=${cred.igToken}`);
    if (!cm.data.length) console.log('  YORUM   : (yok)');
    for (const c of cm.data) console.log(`  YORUM   : [${c.id}] ${c.text}`);
  } catch (e) {
    console.log(`  YORUM   : okunamadı (${e.message})`);
  }
}
