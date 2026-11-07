/**
 * Valida o conteúdo do FitZero contra os critérios de [CONT-01] e [CONT-02].
 * Uso (dentro de tools/):  npm run validate      (sai com código 1 se algo falhar)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExercisePrescription } from '../workout-session.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warns = [];
const fail = (m) => errors.push(m);

const exercises = JSON.parse(readFileSync(join(root, 'exercises.json'), 'utf8'));
const REQUIRED = [
  'id', 'nome_popular', 'ambiente', 'nivel', 'tempo_estimado_min',
  'foco_muscular', 'series_recomendadas', 'regressao_segura', 'pontos_atencao'
];
const AMBIENTES = ['casa', 'praca'];
// Jargões em inglês que não devem aparecer nos textos para o público
const JARGOES = /\b(core|workout|push[- ]?up|pull[- ]?up|squat|plank|lunge|bridge|bird[- ]?dog|dips?|reps?|sets?|burn|cardio|hiit|abs)\b/i;

if (!Array.isArray(exercises)) fail('exercises.json deve ser um array');
if (exercises.length < 12) fail(`mínimo de 12 rotinas (há ${exercises.length})`);

const ids = new Set();
for (const ex of exercises) {
  const tag = ex.id || '(sem id)';
  for (const k of REQUIRED) {
    if (ex[k] === undefined || ex[k] === null || ex[k] === '') fail(`${tag}: campo obrigatório ausente: ${k}`);
  }
  if (ids.has(ex.id)) fail(`${tag}: id duplicado`);
  ids.add(ex.id);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(ex.id || '')) fail(`${tag}: id deve ser kebab-case ASCII`);
  if (!AMBIENTES.includes(ex.ambiente)) fail(`${tag}: ambiente deve ser ${AMBIENTES.join(' | ')}`);
  if (!Number.isInteger(ex.tempo_estimado_min) || ex.tempo_estimado_min <= 0) {
    fail(`${tag}: tempo_estimado_min deve ser inteiro positivo`);
  }
  for (const k of ['nome_popular', 'foco_muscular', 'regressao_segura', 'pontos_atencao', 'series_recomendadas']) {
    if (JARGOES.test(ex[k] || '')) fail(`${tag}: jargão em inglês em ${k}: "${(ex[k].match(JARGOES) || [])[0]}"`);
  }

  // O motor de treino (Dev 3) precisa entender a prescrição
  if (!/\d+\s*séries?/i.test(ex.series_recomendadas || '')) fail(`${tag}: series_recomendadas sem "N séries"`);
  const rx = parseExercisePrescription(ex);
  const lida = rx.kind === 'time' ? rx.seconds > 0 : rx.minimum > 0 && rx.maximum >= rx.minimum;
  if (!lida) fail(`${tag}: prescrição não interpretada pelo motor de treino`);
  if (!/\d+\s*(?:a|até|-)?\s*\d*\s*(repetições?|segundos?)/i.test(ex.series_recomendadas || '')) {
    fail(`${tag}: series_recomendadas deve citar repetições ou segundos`);
  }

  // Ilustração
  const svgPath = join(root, 'assets', 'svg', `${ex.id}.svg`);
  if (!existsSync(svgPath)) {
    fail(`${tag}: falta assets/svg/${ex.id}.svg`);
    continue;
  }
  const svg = readFileSync(svgPath, 'utf8');
  const bytes = Buffer.byteLength(svg);
  if (bytes >= 10 * 1024) fail(`${tag}: SVG com ${bytes} B (teto: 10 KB)`);
  if (!svg.startsWith('<svg') || !svg.includes('viewBox="0 0 240 140"')) fail(`${tag}: SVG sem viewBox 0 0 240 140`);
  if (/<script|<style|<image|<foreignObject|\son\w+=|href=["']https?:/i.test(svg)) {
    fail(`${tag}: SVG com conteúdo não permitido (script/style/imagem/link externo)`);
  }
  for (const cls of ['svg-muscle-highlight', 'svg-force-arrow']) {
    if (!svg.includes(cls)) fail(`${tag}: SVG sem elemento .${cls}`);
  }
  if (!svg.includes('<animate ')) fail(`${tag}: SVG sem animação do boneco (<animate>)`);
  if (/<animate [^>]*dur="(\d+(?:\.\d+)?)s"/.test(svg) && Number(RegExp.$1) < 4) {
    fail(`${tag}: animação rápida demais (ciclo mínimo de 4 s para manter o movimento suave)`);
  }
  if (!svg.includes('var(--accent-teal)')) fail(`${tag}: SVG sem linha da coluna (--accent-teal)`);
  if (!svg.includes('var(--warning)')) fail(`${tag}: SVG sem pontos de apoio (--warning)`);
}

// Cobertura dos ambientes e dos filtros de foco do app
for (const amb of AMBIENTES) {
  if (exercises.filter((e) => e.ambiente === amb).length < 3) fail(`poucas rotinas no ambiente "${amb}"`);
}

// Pré-cache do Service Worker precisa listar todos os SVGs
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
for (const ex of exercises) {
  if (!sw.includes(`./assets/svg/${ex.id}.svg`)) fail(`sw.js: ${ex.id}.svg não está no PRECACHE_ASSETS`);
}

// Orçamento do bundle (arquivos servidos pelo app; ignora tools/, .git, .github e o roteiro)
const IGNORAR = new Set(['.git', '.github', 'tools', 'node_modules', '.gitignore', '.nojekyll']);
let total = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (IGNORAR.has(name) || /\.(docx|md)$/i.test(name) || name.endsWith('.rar')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else total += statSync(full).size;
  }
};
walk(root);
const kb = total / 1024;
if (kb > 850) fail(`bundle com ${kb.toFixed(1)} KB (teto operacional: 850 KB)`);

console.log(`Rotinas: ${exercises.length} (casa: ${exercises.filter((e) => e.ambiente === 'casa').length}, praça: ${exercises.filter((e) => e.ambiente === 'praca').length})`);
console.log(`Bundle estático: ${kb.toFixed(1)} KB de 850 KB`);
warns.forEach((w) => console.warn('AVISO:', w));
if (errors.length) {
  console.error(`\n${errors.length} problema(s):`);
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}
console.log('OK: conteúdo válido.');
