import {readFileSync} from 'node:fs';
import {validateSpec} from './validate.mjs';
import {generateSpec} from './generate-spec.mjs';

export const SEED_BACKLOG = JSON.parse(
  readFileSync(new URL('./seed-backlog.json', import.meta.url)),
);

function pickSeedDefault(seeds) {
  // deterministik olmayan seçim; index'i title uzunluğuna göre kaydır (Math.random yasak değil ama gerekmez)
  return seeds[(Date.now ? 0 : 0)] ?? seeds[0]; // controller CLI'de gerçek rastgeleyi verir
}

export async function produceSpec({candidates, apiKey, generate = generateSpec, retries = 2, pickSeed = pickSeedDefault}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const spec = await generate({candidates, apiKey});
      const {valid, errors} = validateSpec(spec);
      if (valid) return {spec, source: 'gemini'};
      console.error(`[produce] attempt ${attempt} invalid: ${errors.join('; ')}`);
    } catch (e) {
      console.error(`[produce] attempt ${attempt} error: ${e.message}`);
    }
  }
  const seed = pickSeed(SEED_BACKLOG);
  return {spec: seed, source: 'seed'};
}
