import {FOOTAGE_SETS} from '../fetch/fetch-footage.mjs';
import {SAGLIK_BEDEN_KEYS} from './pillars.mjs';

export function resolveFootageSet(brand, pillarKey) {
  const name = (brand?.altFootageSet && SAGLIK_BEDEN_KEYS.has(pillarKey))
    ? brand.altFootageSet : (brand?.footageSet ?? 'tech');
  if (!Object.hasOwn(FOOTAGE_SETS, name)) throw new Error(`unknown footageSet: ${name}`);
  return name;
}
