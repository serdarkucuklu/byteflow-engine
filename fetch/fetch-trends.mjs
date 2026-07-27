import Parser from 'rss-parser';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Ürün/özellik duyurusu feed'leri ÖNCE: %75 güncel-içerik kuralının haber kaynağı bunlar
// (yeni model sürümleri, yeni çıkan asistan özellikleri). Round-robin karışımda öncelik alırlar.
const AI_NEWS = [
  {url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'techcrunch-ai'},
  {url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'verge-ai'},
  {url: 'https://blog.google/technology/ai/rss/', source: 'google-ai'},
  {url: 'https://hnrss.org/frontpage', source: 'hackernews'},
  {url: 'http://export.arxiv.org/rss/cs.AI', source: 'arxiv-ai'},
  {url: 'http://export.arxiv.org/rss/cs.LG', source: 'arxiv-ml'},
  {url: 'https://www.redhat.com/en/rss/blog', source: 'redhat'},
  {url: 'https://medium.com/feed/tag/software-engineering', source: 'medium-se'},
  // Topluluk nabzı: asistan/model tartışmalarının GERÇEKTEN popüler olduğu yerler.
  // (Reddit datacenter IP'lerinden 403 dönebilir — fetchTrends zaten feed başına
  //  hata yutuyor, o gün sadece bu kaynak eksik kalır.)
  {url: 'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=week', source: 'reddit-localllama'},
  {url: 'https://www.reddit.com/r/ClaudeAI/top/.rss?t=week', source: 'reddit-claude'},
  {url: 'https://www.reddit.com/r/OpenAI/top/.rss?t=week', source: 'reddit-openai'},
  {url: 'https://medium.com/feed/tag/large-language-models', source: 'medium-llm'},
  {url: 'https://medium.com/feed/tag/ai-agents', source: 'medium-agents'},
];

// Cilt bakımı bilimi kaynakları: kozmetik kimyası blogları + topluluk nabzı. Amaç ürün
// reklamı değil, hangi ETKEN MADDE/iddia gündemde onu yakalamak.
const SKINCARE_NEWS = [
  {url: 'https://labmuffin.com/feed/', source: 'labmuffin'},
  {url: 'https://theskincareedit.com/feed', source: 'skincare-edit'},
  {url: 'https://www.byrdie.com/rss', source: 'byrdie'},
  {url: 'https://www.allure.com/feed/rss', source: 'allure'},
  {url: 'https://www.reddit.com/r/SkincareAddiction/top/.rss?t=week', source: 'reddit-sca'},
  {url: 'https://www.reddit.com/r/AsianBeauty/top/.rss?t=week', source: 'reddit-ab'},
  {url: 'https://www.reddit.com/r/30PlusSkinCare/top/.rss?t=week', source: 'reddit-30plus'},
  {url: 'https://medium.com/feed/tag/skincare', source: 'medium-skincare'},
];

// Kaynak kümeleri — marka dosyası hangisini kullanacağını söyler.
export const FEED_SETS = {'ai-news': AI_NEWS, 'skincare-news': SKINCARE_NEWS};
export const FEEDS = AI_NEWS;                      // geriye uyum

export function feedsFor(setName = 'ai-news') {
  const set = FEED_SETS[setName];
  if (!set) throw new Error(`bilinmeyen feed kümesi: ${setName} (${Object.keys(FEED_SETS).join(', ')})`);
  return set;
}

// Reddit varsayılan UA'lı isteklere 429/403 dönüyor → tarayıcıya benzer UA + Accept.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; byteflow-bot/1.0; +https://instagram.com/byteflowlabs)',
  Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
};

// agent:false → keep-alive soketi kalmasın (yoksa event loop kapanmıyor, CI adımı asılı kalır).
export async function fetchTrends({limit = 20, feeds = FEEDS, parser = new Parser({timeout: 20000, headers: HEADERS, requestOptions: {agent: false}})} = {}) {
  const perFeed = [];
  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = [];
      for (const item of (parsed.items ?? []).slice(0, 8)) {
        if (!item.title) continue;
        items.push({
          title: item.title.trim(),
          summary: (item.contentSnippet ?? item.content ?? '').slice(0, 400),
          link: item.link ?? '',
          source: feed.source,
        });
      }
      perFeed.push(items);
    } catch (e) {
      console.error(`[fetch] ${feed.source} failed: ${e.message}`);
    }
  }
  // Round-robin karışım: limit dilimi tek feed'e boğulmasın — her feed'den sırayla 1'er item.
  const results = [];
  for (let i = 0; results.length < limit; i++) {
    let added = false;
    for (const items of perFeed) {
      if (i < items.length) {
        results.push(items[i]);
        added = true;
        if (results.length >= limit) break;
      }
    }
    if (!added) break;
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = await fetchTrends();
  writeFileSync(new URL('../candidates.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log(`✓ ${out.length} candidates → candidates.json`);
  process.exit(0); // açık kalan feed soketleri süreci asmasın
}
