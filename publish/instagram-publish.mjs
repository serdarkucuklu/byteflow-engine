// Instagram Reels yayını — Graph API (FB-login path).
// container oluştur → durum FINISHED olana kadar bekle → publish.
const V = 'v21.0';
const G = `https://graph.facebook.com/${V}`;

async function fbPost(path, params) {
  const r = await fetch(`${G}/${path}`, {method: 'POST', body: new URLSearchParams(params)});
  const d = await r.json();
  if (d.error) throw new Error(`${d.error.code}/${d.error.error_subcode ?? ''}: ${d.error.message}`);
  return d;
}
async function fbGet(path, params) {
  const r = await fetch(`${G}/${path}?${new URLSearchParams(params)}`);
  const d = await r.json();
  if (d.error) throw new Error(`${d.error.code}: ${d.error.message}`);
  return d;
}

export async function publishReel({videoUrl, caption, igUserId, token, pollMs = 3000, maxPolls = 60, onStatus}) {
  if (!igUserId || !token) throw new Error('IG_USER_ID / IG_ACCESS_TOKEN missing');
  // 1) container
  const c = await fbPost(`${igUserId}/media`, {
    media_type: 'REELS', video_url: videoUrl, caption, share_to_feed: 'true', access_token: token,
  });
  const creationId = c.id;
  onStatus?.(`container ${creationId} oluşturuldu, işleniyor…`);
  // 2) poll
  for (let i = 0; i < maxPolls; i++) {
    const s = await fbGet(`${creationId}`, {fields: 'status_code,status', access_token: token});
    if (s.status_code === 'FINISHED') { onStatus?.('container FINISHED'); break; }
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED')
      throw new Error(`container ${s.status_code}: ${s.status ?? ''}`);
    if (i === maxPolls - 1) throw new Error('container hazır olmadı (timeout)');
    await new Promise(r => setTimeout(r, pollMs));
  }
  // 3) publish
  const p = await fbPost(`${igUserId}/media_publish`, {creation_id: creationId, access_token: token});
  onStatus?.(`yayınlandı: media ${p.id}`);
  return p.id;
}
