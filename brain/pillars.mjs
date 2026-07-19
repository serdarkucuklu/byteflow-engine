// @byteflowlabs niş kilidi: her post bu AI/LLM engineering pillar'larından birinin içinde kalır.
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
  {key: 'model-releases', focus: 'what changed in the latest model release (e.g. a new Sonnet/GPT/Gemini): the concrete differences that matter to users — use timely trending headlines'},
  {key: 'model-comparison', focus: 'Claude vs ChatGPT vs Gemini: real differences in context, strengths, pricing, when to use which'},
  {key: 'paid-tiers', focus: 'what Claude Max / ChatGPT Plus / Gemini Advanced actually buy you: bigger context, higher limits, smarter model, priority'},
  {key: 'reasoning-models', focus: "how 'thinking'/reasoning models (GPT-5, Claude extended thinking) work: predicting a scratchpad before the answer"},
];

// LRU: son kullanılan pillar'ları atla; hepsi yakın zamanda kullanıldıysa en eskiyi seç.
// recentKeys: en eski→en yeni sıralı pillar anahtarları (çağıran son N'i verir).
export function selectPillar(recentKeys = []) {
  const recent = new Set(recentKeys);
  const fresh = PILLARS.filter(p => !recent.has(p.key));
  if (fresh.length) return fresh[0];
  const oldestKey = recentKeys[0];
  return PILLARS.find(p => p.key === oldestKey) ?? PILLARS[0];
}
