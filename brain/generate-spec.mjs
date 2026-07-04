const MODEL = 'gemini-2.5-flash';
const ENDPOINT = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

// Gemini responseSchema — scene-spec şeklini ZORLAR
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['title', 'scenes', 'caption', 'hashtags'],
  properties: {
    title: {type: 'STRING'},
    caption: {type: 'STRING'},
    hashtags: {type: 'ARRAY', items: {type: 'STRING'}},
    scenes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['layout', 'nodes', 'steps'],
        properties: {
          layout: {type: 'STRING', enum: ['nodes-flow']},
          heading: {type: 'STRING'},
          nodes: {type: 'ARRAY', items: {type: 'OBJECT', required: ['id', 'label'],
            properties: {id: {type: 'STRING'}, label: {type: 'STRING'}, icon: {type: 'STRING'}}}},
          steps: {type: 'ARRAY', items: {type: 'OBJECT', required: ['from', 'to', 'packet', 'status'],
            properties: {from: {type: 'STRING'}, to: {type: 'STRING'}, packet: {type: 'STRING'},
              color: {type: 'STRING', enum: ['accent', 'good', 'warn']}, status: {type: 'STRING'}}}},
        },
      },
    },
  },
};

const PROMPT = (candidates) => `You are the content brain for @byteflow, an Instagram page of clean animated
software/AI explainer Reels (flat dark diagrams: boxes = components, packets = data flowing between them).

From these trending tech headlines, pick the SINGLE best topic to explain as a 10-20s animated diagram,
then produce a scene-spec. Prefer timeless system-design / AI-infra concepts the headline evokes over
ephemeral news. Make it globally understandable, English.

Rules:
- 1 to 3 scenes. Each scene layout is exactly "nodes-flow".
- 2 to 3 nodes per scene. node.label <= 16 chars, UPPERCASE. node.icon = ONE emoji.
- 1 to 6 steps per scene. Each step.from and step.to MUST equal an existing node.id IN THAT SCENE.
- step.packet <= 6 chars (e.g. "GET", "200", "SYN"). step.color in {accent, good, warn}. step.status <= 40 chars, lowercase.
- title <= 60 chars. caption ends with "Follow @byteflow for daily systems & AI breakdowns." 3-6 hashtags.

Headlines:
${candidates.slice(0, 15).map((c, i) => `${i + 1}. [${c.source}] ${c.title}`).join('\n')}`;

export async function generateSpec({candidates, apiKey, fetchFn = fetch}) {
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const res = await fetchFn(ENDPOINT(apiKey), {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      contents: [{parts: [{text: PROMPT(candidates)}]}],
      generationConfig: {responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.9},
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text');
  return JSON.parse(text);
}
