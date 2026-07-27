// Marka sembolleri — jenerik emoji yerine gerçek ürün logoları.
//
// Kaynak: simple-icons (CC0 veri paketi; logoların kendisi sahiplerinin markasıdır —
// burada yalnızca EDİTORYAL/açıklayıcı kullanım var, sponsorluk/onay ima edilmiyor).
// simple-icons'ta bulunmayanlar (OpenAI/ChatGPT, Grok) için kelime-rozet: markanın
// rengi + kısa kelime işareti. Logoyu uydurmaktansa dürüst bir rozet daha iyi.
import * as si from 'simple-icons';
import {BRAND_KEYS as KEYS} from './brand-keys.mjs';

export interface Brand {
  label: string;      // rozet/etiket metni (wordmark modunda ekrana basılır)
  color: string;      // marka rengi (koyu zeminde okunur hâle getirilmiş)
  path?: string;      // simple-icons 24x24 path verisi (varsa ikon modunda çizilir)
}

// Koyu zeminde siyah/koyu logolar kaybolur → görünür bir tona sabitliyoruz.
const ON_DARK: Record<string, string> = {
  anthropic: '#E8E3DC', ollama: '#EDEDED', x: '#E6EDF3', github: '#E6EDF3',
  vercel: '#E6EDF3', apple: '#E6EDF3',
};

function icon(key: keyof typeof si, label: string, color?: string): Brand {
  const ic = si[key] as unknown as {path: string; hex: string} | undefined;
  return {label, color: color ?? (ic ? `#${ic.hex}` : '#8b949e'), path: ic?.path};
}

// Beyin yalnızca bu anahtarları kullanabilir (scene-spec şemasında enum).
export const BRANDS: Record<string, Brand> = {
  claude: icon('siClaude', 'Claude'),
  anthropic: icon('siAnthropic', 'Anthropic', ON_DARK.anthropic),
  gemini: icon('siGooglegemini', 'Gemini'),
  google: icon('siGoogle', 'Google'),
  deepseek: icon('siDeepseek', 'DeepSeek'),
  perplexity: icon('siPerplexity', 'Perplexity'),
  mistral: icon('siMistralai', 'Mistral'),
  huggingface: icon('siHuggingface', 'HF'),
  ollama: icon('siOllama', 'Ollama', ON_DARK.ollama),
  copilot: icon('siGithubcopilot', 'Copilot', '#E6EDF3'),
  cursor: icon('siCursor', 'Cursor', '#E6EDF3'),
  langchain: icon('siLangchain', 'LangChain'),
  github: icon('siGithub', 'GitHub', ON_DARK.github),
  python: icon('siPython', 'Python'),
  docker: icon('siDocker', 'Docker'),
  postgres: icon('siPostgresql', 'Postgres'),
  redis: icon('siRedis', 'Redis'),
  cloudflare: icon('siCloudflare', 'Cloudflare'),
  nvidia: icon('siNvidia', 'NVIDIA'),
  meta: icon('siMeta', 'Meta'),
  // Logosu simple-icons'ta olmayanlar → kelime rozeti (marka renginde).
  openai: {label: 'OpenAI', color: '#10A37F'},
  chatgpt: {label: 'ChatGPT', color: '#10A37F'},
  grok: {label: 'Grok', color: '#E6EDF3'},
  xai: {label: 'xAI', color: '#E6EDF3'},
  mcp: {label: 'MCP', color: '#c8a2ff'},
};

// brand-keys.mjs TEK kaynak; buradaki tablo ile birebir örtüşmeli (test bunu doğruluyor).
export const BRAND_KEYS = KEYS;

export function brandOf(key?: string): Brand | undefined {
  return key ? BRANDS[key.toLowerCase()] : undefined;
}
