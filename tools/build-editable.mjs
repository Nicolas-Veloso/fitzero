/**
 * Gera os arquivos-fonte EDITÁVEIS (Inkscape) a partir das mesmas poses usadas no app:
 * tools/fontes-inkscape/<id>.svg  — camadas nomeadas, caminhos <path> com nós editáveis,
 * cores reais (o Inkscape não entende var(--cor)) e fundo escuro travado.
 * São só para abrir/ajustar no editor; o que vai para o app é assets/svg/ (animado e otimizado).
 *
 * Uso (dentro de tools/):  npm run build:fonte
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elementsOf, poses } from './svg-poses.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), 'fontes-inkscape');
mkdirSync(out, { recursive: true });

// Mesmas cores do tema escuro (styles.css)
const COR = {
  '--text-primary': '#f5f5f7',
  '--border-strong': '#383840',
  '--accent': '#d4ff00',
  '--accent-teal': '#00e5b0',
  '--warning': '#ffd60a'
};
const cor = (v) => String(v).replace(/var\((--[\w-]+)\)/g, (_, n) => COR[n] || '#ffffff');

// Exercícios em que o destaque muscular é a região das escápulas
const ESCAPULAR = new Set(['remada-australiana-praca', 'barra-fixa-escapular']);

const camadaDe = (id, { tag, attrs: a }) => {
  const cls = a.class || '';
  if (cls.includes('svg-posture-line')) return 'alinhamento-coluna';
  if (a.stroke === 'var(--accent-teal)' && tag === 'polyline' && a['stroke-width'] === 4) return 'alinhamento-coluna';
  if (cls.includes('svg-muscle-highlight')) return ESCAPULAR.has(id) ? 'escapula-ativa' : 'musculo-ativo';
  if (cls.includes('svg-breath')) return 'anel-respiracao';
  if (cls.includes('svg-force-arrow') || (tag === 'path' && a.stroke === 'var(--accent)')) return 'seta-forca';
  if (tag === 'circle' && a.fill === 'var(--warning)') return 'pontos-apoio';
  if (a.stroke === 'var(--border-strong)') return 'estrutura-ambiente';
  return 'vetor-corpo';
};

const ORDEM = ['estrutura-ambiente', 'vetor-corpo', 'musculo-ativo', 'escapula-ativa', 'alinhamento-coluna', 'pontos-apoio', 'seta-forca', 'anel-respiracao'];

const toPath = (points) =>
  'M' + points.trim().split(/\s+/).map((p) => p.replace(',', ' ')).join(' L');

const serial = (e, n) => {
  let { tag, attrs } = e;
  const a = { ...attrs };
  delete a.class;
  if (tag === 'polyline') {
    a.d = toPath(a.points);
    delete a.points;
    tag = 'path';
  }
  if (tag === 'line') {
    a.d = `M${a.x1} ${a.y1} L${a.x2} ${a.y2}`;
    for (const k of ['x1', 'y1', 'x2', 'y2']) delete a[k];
    tag = 'path';
  }
  const fill = a.fill !== undefined ? cor(a.fill) : 'none';
  const txt = Object.entries({ ...a, fill })
    .map(([k, v]) => `${k}="${cor(v)}"`)
    .join(' ');
  return `<${tag} id="${tag}${n}" ${txt} stroke-linecap="round" stroke-linejoin="round"/>`;
};

for (const id of Object.keys(poses)) {
  const grupos = Object.fromEntries(ORDEM.map((c) => [c, []]));
  elementsOf(id, 'A').forEach((e, i) => grupos[camadaDe(id, e)].push(serial(e, i)));
  const camadas = ORDEM.filter((c) => grupos[c].length)
    .map(
      (c) =>
        `  <g id="${c}" inkscape:groupmode="layer" inkscape:label="${c}">\n    ${grupos[c].join('\n    ')}\n  </g>`
    )
    .join('\n');
  const svg =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" ' +
    'xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" width="960" height="560" viewBox="0 0 240 140">\n' +
    `  <sodipodi:namedview id="base" pagecolor="#111114" inkscape:pageopacity="1" inkscape:zoom="1" inkscape:current-layer="vetor-corpo"/>\n` +
    '  <g id="fundo" inkscape:groupmode="layer" inkscape:label="fundo" sodipodi:insensitive="true">\n' +
    '    <rect width="240" height="140" fill="#111114"/>\n  </g>\n' +
    camadas +
    '\n</svg>\n';
  writeFileSync(join(out, `${id}.svg`), svg, 'utf8');
}
console.log(`${Object.keys(poses).length} arquivos-fonte em tools/fontes-inkscape/`);
