/**
 * Gera e otimiza os SVGs dos exercícios: tools/svg-poses.mjs -> SVGO -> assets/svg/<id>.svg
 * Uso (dentro de tools/):  npm install && npm run build:svg
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';
import config from './svgo.config.mjs';
import { buildAllRaw } from './svg-poses.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'svg');
mkdirSync(outDir, { recursive: true });

let total = 0;
for (const [id, raw] of Object.entries(buildAllRaw())) {
  const { data } = optimize(raw, { ...config, path: `${id}.svg` });
  writeFileSync(join(outDir, `${id}.svg`), data + '\n', 'utf8');
  const bytes = Buffer.byteLength(data);
  total += bytes;
  console.log(`${id.padEnd(28)} ${String(bytes).padStart(5)} B (bruto ${Buffer.byteLength(raw)} B)`);
}
console.log(`\n${Object.keys(buildAllRaw()).length} SVGs, total ${(total / 1024).toFixed(1)} KB -> assets/svg/`);
