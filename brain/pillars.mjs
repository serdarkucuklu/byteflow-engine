// @byteflowlabs niş kilidi: her post bu AI/LLM engineering pillar'larından birinin içinde kalır.
// timely: true → güncel-haber pillar'ı (yeni çıkan özellik / yeni model sürümü; trend başlıklarına demir atar).
// Serdar direktifi (2026-07): postların %75'i timely pillar'lardan çıkar — bkz. selectPillar.
export const PILLARS = [
  {key: 'agents', focus: 'autonomous LLM agents: planning, tool use, loops, memory, multi-agent handoff'},
  {key: 'rag', focus: 'retrieval-augmented generation: chunking, embeddings, reranking, retrieval quality'},
  {key: 'context', focus: 'context windows: token budgets, context rot, prompt caching, long-context tradeoffs'},
  {key: 'embeddings', focus: 'embeddings and vector search: similarity, dimensions, hybrid search'},
  {key: 'inference', focus: 'inference and serving: latency, batching, KV cache, quantization, streaming'},
  {key: 'evaluation', focus: 'LLM evaluation: benchmarks, eval harnesses, LLM-as-judge pitfalls'},
  {key: 'prompting', focus: 'prompt engineering: structured output, few-shot, system prompts, failure modes'},
  {key: 'cost-latency', focus: 'cost and latency: token economics, caching, model routing, cheaper vs smarter'},
  {key: 'guardrails', focus: 'safety and guardrails: prompt injection, jailbreaks, output validation, PII'},
  {key: 'vector-db', focus: 'vector databases: HNSW/IVF indexing, metadata filtering, scaling retrieval'},
  {key: 'observability', focus: 'LLM observability: tracing, token accounting, debugging bad outputs'},
  {key: 'mcp-tools', focus: 'tool calling and MCP: function schemas, tool orchestration, Model Context Protocol'},
  {key: 'fine-tuning', focus: 'fine-tuning vs prompting vs RAG: when each wins, LoRA, data prep'},
  {key: 'model-internals', focus: 'how ChatGPT / Claude / Gemini actually work under the hood: tokens, context window, attention, next-token prediction, streaming'},
  {key: 'model-releases', timely: true, focus: 'what changed in the LATEST model release — a brand-new Claude / GPT / Gemini / Grok version bump from this week\'s headlines: the concrete differences that matter to users, not marketing claims. ALWAYS anchor on a timely trending headline'},
  {key: 'model-comparison', focus: 'Claude vs ChatGPT vs Gemini: real differences in context, strengths, pricing, when to use which'},
  {key: 'paid-tiers', focus: 'what Claude Max / ChatGPT Plus / Gemini Advanced actually buy you: bigger context, higher limits, smarter model, priority'},
  {key: 'reasoning-models', focus: "how 'thinking'/reasoning models (GPT-5, Claude extended thinking) work: predicting a scratchpad before the answer"},
  {key: 'assistant-features', focus: "what the AI assistants' platform features actually do under the hood: Claude Skills / Projects / Artifacts / MCP, ChatGPT custom GPTs / apps / plugins, Gemini Gems / extensions, Grok modes"},
  {key: 'coding-environments', timely: true, focus: 'agentic coding environments and their NEWLY shipped capabilities: Claude Code, Cursor, Copilot, Codex CLI — new skills, plugins, MCP servers, desktop apps; how these tools actually drive the model and where they fail. Prefer what just shipped from the trending headlines'},
  {key: 'assistant-updates', timely: true, focus: 'newly shipped features across Claude / ChatGPT / Gemini / Grok — e.g. a new desktop app, design tool, flow builder, voice/omni mode (use timely trending headlines): what shipped, how it actually works, whether it matters'},
];

// %75 güncel-içerik kuralı: 4 postluk deterministik pencerede 3 timely + 1 evergreen.
// postCount = bugüne kadarki toplam post sayısı (history.length).
// Seçilen grup içinde LRU: yakın zamanda kullanılmayanı, hepsi kullanıldıysa en eskisini seç.
export function selectPillar(recentKeys = [], postCount = 0) {
  const wantTimely = postCount % 4 !== 3;
  const group = PILLARS.filter(p => Boolean(p.timely) === wantTimely);
  const recent = new Set(recentKeys);
  const fresh = group.filter(p => !recent.has(p.key));
  if (fresh.length) return fresh[0];
  const oldestKey = recentKeys.find(k => group.some(p => p.key === k));
  return group.find(p => p.key === oldestKey) ?? group[0];
}
