import {readFileSync} from 'node:fs';
import {validateSpec} from './validate.mjs';
import {generateSpec} from './generate-spec.mjs';

export const SEED_BACKLOG = JSON.parse(
  readFileSync(new URL('./seed-backlog.json', import.meta.url)),
);

function pickSeedDefault(seeds) {
  // Deterministic default: always pick the first seed. Callers that want real
  // randomness (e.g. run-daily.mjs's CLI flow) inject their own pickSeed.
  return seeds[0];
}

export async function produceSpec({candidates, apiKey, generate = generateSpec, retries = 2, pickSeed = pickSeedDefault, backoffMs = 400}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const spec = await generate({candidates, apiKey});
      const {valid, errors} = validateSpec(spec);
      if (valid) return {spec, source: 'gemini'};
      console.error(`[produce] attempt ${attempt} invalid: ${errors.join('; ')}`);
    } catch (e) {
      console.error(`[produce] attempt ${attempt} error: ${e.message}`);
    }
    if (attempt < retries) await new Promise(r => setTimeout(r, backoffMs * (attempt + 1)));
  }
  const seed = pickSeed(SEED_BACKLOG);
  return {spec: seed, source: 'seed'};
}
