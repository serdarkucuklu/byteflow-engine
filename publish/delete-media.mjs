// Yayınlanmış bir gönderiyi SİLER (geri alınamaz).
//
// Neden var: bu motor otomatik yayın yapıyor; yanlış bir gönderi çıktığında (2026-07-28'de
// @cilt.kodu'ya AI konulu reel çıktı) tek kurtarma yolu silmek. Token GitHub secret'ında
// durduğu için silme de repo içinden, workflow üzerinden yapılıyor — anahtar diske inmiyor.
//
// Kullanım: BYTEFLOW_BRAND=ciltkodu node publish/delete-media.mjs <mediaId> [mediaId...]
// Gereken izin: instagram_manage_contents (yoksa Graph API 200 yerine hata döner).
import {loadBrand, credentials} from '../brands/load.mjs';

// graph.facebook.com — publish/instagram-publish.mjs ile AYNI host olmak zorunda. Bu hesapların
// token'ı Facebook Login token'ı; graph.instagram.com yalnız Instagram Login token'ı kabul edip
// "Cannot parse access token" diyor (2026-07-28'de silme bu yüzden düştü).
const GRAPH = 'https://graph.facebook.com/v21.0';

const brand = loadBrand();
const cred = credentials(brand);
if (!cred.igToken) throw new Error(`${brand.slug}: Instagram token'ı yok`);

const ids = process.argv.slice(2).filter(Boolean);
if (!ids.length) throw new Error('en az bir mediaId gerekli');

let failed = 0;
for (const id of ids) {
  // Silmeden ÖNCE ne olduğunu yaz: yanlış id verilmişse log'da görünsün, sessizce
  // doğru gönderi silinmesin.
  try {
    const info = await fetch(`${GRAPH}/${id}?fields=id,media_type,caption,timestamp&access_token=${cred.igToken}`);
    const meta = await info.json();
    if (meta.error) throw new Error(meta.error.message);
    console.log(`· silinecek [${meta.media_type}] ${meta.timestamp}: ${(meta.caption ?? '').slice(0, 70)}…`);
  } catch (e) {
    console.error(`⚠ ${id}: bilgi okunamadı (${e.message}) — yine de silme denenecek`);
  }

  const res = await fetch(`${GRAPH}/${id}?access_token=${cred.igToken}`, {method: 'DELETE'});
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    failed++;
    console.error(`✗ ${id} silinemedi: ${body.error?.message ?? res.status}`);
  } else {
    console.log(`✓ silindi: ${id}`);
  }
}
if (failed) process.exit(1);
