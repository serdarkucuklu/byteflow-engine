// Threads yayını — Threads API (graph.threads.net, IG'den AYRI token gerekir).
// container (VIDEO + text) → status FINISHED bekle → threads_publish.
const G = 'https://graph.threads.net/v1.0';

async function post(path, params) {
  const r = await fetch(`${G}/${path}`, {method: 'POST', body: new URLSearchParams(params)});
  const d = await r.json();
  if (d.error) throw new Error(`${d.error.code ?? ''}: ${d.error.message}`);
  return d;
}
async function get(path, params) {
  const r = await fetch(`${G}/${path}?${new URLSearchParams(params)}`);
  const d = await r.json();
  if (d.error) throw new Error(`${d.error.code ?? ''}: ${d.error.message}`);
  return d;
}

export async function publishThread({userId, token, videoUrl, text, pollMs = 3000, maxPolls = 60, onStatus}) {
  if (!userId || !token) throw new Error('THREADS_USER_ID / THREADS_TOKEN missing');
  // 1) container
  const c = await post(`${userId}/threads`, {media_type: 'VIDEO', video_url: videoUrl, text, access_token: token});
  onStatus?.(`Threads container ${c.id} işleniyor…`);
  // 2) status bekle
  for (let i = 0; i < maxPolls; i++) {
    const s = await get(`${c.id}`, {fields: 'status', access_token: token});
    if (s.status === 'FINISHED') break;
    if (s.status === 'ERROR' || s.status === 'EXPIRED') throw new Error(`Threads container ${s.status}`);
    if (i === maxPolls - 1) throw new Error('Threads container timeout');
    await new Promise(r => setTimeout(r, pollMs));
  }
  // 3) publish
  const p = await post(`${userId}/threads_publish`, {creation_id: c.id, access_token: token});
  onStatus?.(`Threads yayınlandı: ${p.id}`);
  return p.id;
}
