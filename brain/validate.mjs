import Ajv from 'ajv';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const schema = JSON.parse(
  readFileSync(new URL('../scene-spec.schema.json', import.meta.url)),
);
const ajv = new Ajv({allErrors: true});
const validate = ajv.compile(schema);

// Şema geçse de geçmese de kontrol edilebilecek referans bütünlüğü kuralları:
// - bir sahne içinde node id'leri tekil olmalı
// - her step.from / step.to o sahnede var olan bir node id'sine işaret etmeli
function semanticErrors(spec) {
  const errors = [];
  if (!spec || !Array.isArray(spec.scenes)) return errors;
  spec.scenes.forEach((scene, sceneIdx) => {
    if (scene && scene.kind === 'code') return; // code sahnesinde node/step yok
    if (!scene || !Array.isArray(scene.nodes)) return;
    const seen = new Set();
    const ids = new Set();
    for (const n of scene.nodes) {
      const id = n && n.id;
      if (seen.has(id)) {
        errors.push(`/scenes/${sceneIdx} duplicate node id "${id}"`);
      }
      seen.add(id);
      ids.add(id);
    }
    if (Array.isArray(scene.steps)) {
      scene.steps.forEach((step, stepIdx) => {
        if (!step) return;
        if (!ids.has(step.from)) {
          errors.push(`/scenes/${sceneIdx}/steps/${stepIdx} unknown node id "${step.from}"`);
        }
        if (!ids.has(step.to)) {
          errors.push(`/scenes/${sceneIdx}/steps/${stepIdx} unknown node id "${step.to}"`);
        }
      });
    }
  });
  return errors;
}

export function validateSpec(spec) {
  const schemaValid = validate(spec);
  const schemaErrors = schemaValid ? [] : validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`);
  const semantic = schemaValid ? semanticErrors(spec) : [];
  const errors = [...schemaErrors, ...semantic];
  return {valid: errors.length === 0, errors};
}

// CLI: node brain/validate.mjs <path>
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  const spec = JSON.parse(readFileSync(path));
  const res = validateSpec(spec);
  console.log(res.valid ? '✓ valid' : '✗ invalid:\n' + res.errors.join('\n'));
  process.exit(res.valid ? 0 : 1);
}
