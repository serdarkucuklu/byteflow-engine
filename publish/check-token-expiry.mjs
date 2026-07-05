// IG token data-access expiry guard (CI). Token kendini debug eder (app secret gerekmez).
// <THRESHOLD gün kaldıysa GitHub Issue açar (GITHUB_TOKEN ile) → kullanıcıya mail gider.
const G = 'https://graph.facebook.com/v21.0';
const THRESHOLD_DAYS = 14;
const t = process.env.IG_ACCESS_TOKEN;

const dbg = await (await fetch(`${G}/debug_token?input_token=${t}&access_token=${t}`)).json();
if (dbg.error || dbg.data?.is_valid === false) {
  console.log(`::error::IG token geçersiz: ${dbg.error?.message ?? 'is_valid=false'}`);
  process.exit(1);
}
const exp = dbg.data?.data_access_expires_at;
if (!exp) { console.log('::notice::token data-access expiry raporlanmadı, OK'); process.exit(0); }

const daysLeft = Math.round((exp * 1000 - Date.now()) / 86400000);
const dateStr = new Date(exp * 1000).toISOString().slice(0, 10);
console.log(`IG token: ${daysLeft} gün kaldı (data access ${dateStr})`);
if (daysLeft > THRESHOLD_DAYS) { console.log('::notice::token OK'); process.exit(0); }

const gh = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
if (!gh || !repo) { console.log(`::warning::token ${daysLeft}g kaldı ama GITHUB_TOKEN yok, issue açılamadı`); process.exit(0); }
const api = `https://api.github.com/repos/${repo}/issues`;
const hdr = {Authorization: `Bearer ${gh}`, Accept: 'application/vnd.github+json', 'User-Agent': 'byteflow-bot'};
const title = 'ByteFlow: Instagram token yenilenmeli ⚠️';
const existing = await (await fetch(`${api}?state=open`, {headers: hdr})).json();
if (Array.isArray(existing) && existing.some(i => i.title === title)) {
  console.log('::warning::yenileme issue\'ı zaten açık'); process.exit(0);
}
await fetch(api, {method: 'POST', headers: hdr, body: JSON.stringify({
  title,
  body: `Instagram token'ın data-access erişimi ~${daysLeft} gün içinde (**${dateStr}**) kesilecek. O tarihten sonra oto-post durur.\n\n**Yenileme:**\n1. Graph API Explorer → app \`1550391679860216\` → \`instagram_content_publish\` işaretle → Generate Access Token\n2. Kısa token'ı page token'a çevir (repo'daki \`scratchpad/ig-setup.mjs\` mantığı / \`fb_exchange_token\` + \`/me/accounts\`)\n3. Repo → Settings → Secrets → **IG_ACCESS_TOKEN**'ı güncelle\n\n**Kalıcı çözüm (bir kere kur, bir daha uğraşma):** Meta Business Suite → Business Settings → System Users → \`instagram_content_publish\`+pages izinli **System User token** üret (hiç expire olmaz) → IG_ACCESS_TOKEN'a koy.`,
})});
console.log(`::warning::token ${daysLeft} gün kaldı — yenileme issue'ı açıldı`);
