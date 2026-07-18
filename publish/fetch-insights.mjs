// publish/fetch-insights.mjs
// Bir IG medya (Reel) için insight metriklerini çeker. Best-effort — çağıran hataları yutabilir.
const GRAPH = 'https://graph.facebook.com/v21.0';
const METRICS = 'reach,plays,saved,shares,total_interactions';

export async function fetchInsights({mediaId, token, fetchFn = fetch}) {
  const url = `${GRAPH}/${mediaId}/insights?metric=${METRICS}&access_token=${token}`;
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`insights HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const out = {};
  for (const m of data.data ?? []) out[m.name] = m.values?.[0]?.value ?? 0;
  return out;
}
