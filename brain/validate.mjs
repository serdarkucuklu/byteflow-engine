import Ajv from 'ajv';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const schema = JSON.parse(
  readFileSync(new URL('../scene-spec.schema.json', import.meta.url)),
);
const ajv = new Ajv({allErrors: true});
const validate = ajv.compile(schema);

export function validateSpec(spec) {
  const valid = validate(spec);
  const errors = valid ? [] : validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`);
  return {valid, errors};
}

// CLI: node brain/validate.mjs <path>
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  const spec = JSON.parse(readFileSync(path));
  const res = validateSpec(spec);
  console.log(res.valid ? '✓ valid' : '✗ invalid:\n' + res.errors.join('\n'));
  process.exit(res.valid ? 0 : 1);
}
