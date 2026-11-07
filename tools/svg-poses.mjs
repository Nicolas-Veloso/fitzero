/**
 * @file svg-poses.mjs
 * @description Ilustrações animadas dos exercícios (um boneco de traços por exercício).
 * Responsável: Dev 4 [CONT-02 / CONT-03]
 *
 * Cada exercício tem duas posições: A (início) e B (fim, na direção da seta de força).
 * O boneco vai de A para B e volta, devagar (ciclo de 6 s, com aceleração suave),
 * usando animação SVG nativa (SMIL) sobre as coordenadas das juntas: sem JavaScript no
 * laço de animação e sem arquivos extras. O JavaScript do app só pausa a animação quando
 * o aparelho pede movimento reduzido (ver app.js).
 *
 * Linguagem visual (a mesma da legenda do app):
 *   --accent        músculo ativo (classe .svg-muscle-highlight, pulsa)
 *   --accent-teal   linha da coluna e guia de alinhamento
 *   --warning       pontos de apoio
 *   --text-primary  contorno do corpo
 *   --border-strong chão e estruturas (barra, banco, parede)
 *
 * Todas as cenas usam viewBox 0 0 240 140 e o chão em y = 118.
 * Para ajustar um desenho: edite as juntas de A/B aqui e rode `npm run build:svg`.
 */

// ---------- ritmo da animação ----------
const CICLO = '6s'; // A -> B (3 s) -> A (3 s). Mantenha igual ao .svg-breath em styles.css.
const SPLINES = '.45 0 .55 1;.45 0 .55 1'; // aceleração e frenagem suaves

// ---------- matemática ----------
const f = (n) => Math.round(n * 10) / 10;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
const deg = (a, b) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

/** Cotovelo/joelho por cinemática inversa de 2 ossos; side = +1 ou -1 escolhe o lado da dobra. */
const ik = (a, b, l1, l2, side = 1) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  const dd = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const ux = dx / d;
  const uy = dy / d;
  const a1 = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(l1 * l1 - a1 * a1, 0));
  return [a[0] + ux * a1 - uy * h * side, a[1] + uy * a1 + ux * h * side];
};

// ---------- elementos (objetos; viram texto só no final) ----------
const el = (tag, attrs) => ({ tag, attrs });
const P = (list) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
const BODY = 'var(--text-primary)';
const STRUCT = 'var(--border-strong)';

const ground = () => el('line', { x1: 20, y1: 118, x2: 220, y2: 118, stroke: STRUCT, 'stroke-width': 2 });
const line = (a, b, w = 3) => el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: STRUCT, 'stroke-width': w });
const limb = (list) => el('polyline', { points: P(list), stroke: BODY, 'stroke-width': 3 });
const spine = (list) => el('polyline', { points: P(list), stroke: 'var(--accent-teal)', 'stroke-width': 4 });
const head = (c, r = 9) => el('circle', { cx: f(c[0]), cy: f(c[1]), r, stroke: BODY, 'stroke-width': 3 });
const muscle = (list, w = 7) =>
  el('polyline', { class: 'svg-muscle-highlight', points: P(list), stroke: 'var(--accent)', 'stroke-width': w });

/** "Mancha" do músculo: cápsula translúcida centrada em c, meia-extensão h, espessura w, ângulo em graus. */
const capsule = (c, h, w, ang = 0) => {
  const r = (ang * Math.PI) / 180;
  const d = [Math.cos(r) * h, Math.sin(r) * h];
  return el('polyline', {
    class: 'svg-muscle-highlight',
    points: P([sub(c, d), add(c, d)]),
    stroke: 'var(--accent)',
    'stroke-opacity': 0.4,
    'stroke-width': w
  });
};

const support = (x, y) => el('circle', { cx: x, cy: y, r: 5, fill: 'var(--warning)' });
const supportFade = (c, op) =>
  el('circle', { cx: f(c[0]), cy: f(c[1]), r: 5, fill: 'var(--warning)', opacity: op });

const breath = (c, rx, ry) =>
  el('ellipse', { class: 'svg-breath', cx: f(c[0]), cy: f(c[1]), rx, ry, stroke: 'var(--accent-teal)', 'stroke-width': 1.5 });

/** Guia tracejado pelo eixo do corpo, estendido nas pontas (trava postural). */
const postureLine = (a, b, ext = 16) => {
  const u = unit(sub(b, a));
  return el('polyline', {
    class: 'svg-posture-line',
    points: P([sub(a, mul(u, ext)), add(b, mul(u, ext))]),
    stroke: 'var(--accent-teal)',
    'stroke-width': 1.5,
    'stroke-dasharray': '3 5'
  });
};

/** Seta tracejada de força com ponta sólida (a → b). Estática: o boneco é que se move. */
const arrow = (a, b) => {
  const u = unit(sub(b, a));
  const base = sub(b, mul(u, 7));
  const p = [-u[1] * 4.5, u[0] * 4.5];
  return [
    el('line', {
      class: 'svg-force-arrow',
      x1: a[0], y1: a[1], x2: f(base[0]), y2: f(base[1]),
      stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '5 4'
    }),
    el('path', {
      d: `M${f(base[0] + p[0])} ${f(base[1] + p[1])}L${b[0]} ${b[1]}L${f(base[0] - p[0])} ${f(base[1] - p[1])}`,
      stroke: 'var(--accent)', 'stroke-width': 2
    })
  ];
};

// ---------- estruturas ----------
const bench = (x1, x2, top) => [
  el('rect', { x: x1, y: top, width: x2 - x1, height: 6, rx: 2, stroke: STRUCT, 'stroke-width': 2.5 }),
  line([x1 + 8, top + 6], [x1 + 8, 118], 2.5),
  line([x2 - 8, top + 6], [x2 - 8, 118], 2.5)
];
const wall = (x, top = 8) => [
  line([x, top], [x, 118]),
  ...[28, 48, 68, 88, 108].filter((y) => y > top).map((y) => line([x, y], [x + 8, y - 8], 1.5))
];

// ---------- serialização com animação ----------
const animate = (name, a, b) =>
  `<animate attributeName="${name}" values="${a};${b};${a}" dur="${CICLO}" repeatCount="indefinite" ` +
  `calcMode="spline" keyTimes="0;.5;1" keySplines="${SPLINES}"/>`;

const render = (listA, listB) => {
  if (listA.length !== listB.length) throw new Error('poses A e B com números de elementos diferentes');
  return listA
    .map((ea, i) => {
      const eb = listB[i];
      const ka = Object.keys(ea.attrs);
      if (ea.tag !== eb.tag || ka.join() !== Object.keys(eb.attrs).join()) {
        throw new Error(`elemento ${i} (${ea.tag}) difere entre A e B`);
      }
      const attrs = ka.map((k) => `${k}="${ea.attrs[k]}"`).join(' ');
      const anims = ka
        .filter((k) => String(ea.attrs[k]) !== String(eb.attrs[k]))
        .map((k) => animate(k, ea.attrs[k], eb.attrs[k]));
      return anims.length ? `<${ea.tag} ${attrs}>${anims.join('')}</${ea.tag}>` : `<${ea.tag} ${attrs}/>`;
    })
    .join('');
};

const wrap = (inner) =>
  '<svg viewBox="0 0 240 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  `<g stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;

// ---------- poses ----------
// Cada exercício: A (início), B (fim, no sentido da seta) e build(juntas) -> lista de elementos.
export const poses = {
  // CASA ---------------------------------------------------------------
  'flexao-parede-solo': {
    A: { S: [166, 96] },
    B: { S: [172, 71] },
    build: ({ S }) => {
      const ankle = [44, 112];
      const hand = [175, 113];
      const hip = lerp(ankle, S, 0.52);
      const knee = lerp(ankle, S, 0.25);
      const elbow = ik(S, hand, 21, 20, 1);
      const ang = deg(hip, S);
      return [
        ground(), postureLine(ankle, S),
        limb([ankle, knee, hip]), limb([S, elbow, hand]),
        muscle([S, elbow, hand]), capsule(add(lerp(hip, S, 0.9), [-3, 4]), 7, 12, ang),
        spine([S, hip]), head(add(S, mul(unit(sub(S, hip)), 14))),
        support(175, 113), support(44, 113),
        breath(lerp(hip, S, 0.45), 13, 8), arrow([210, 108], [210, 62])
      ];
    }
  },

  'agachamento-livre': {
    A: { hip: [92, 88], lean: 35 },
    B: { hip: [113, 61], lean: 2 },
    build: ({ hip, lean }) => {
      const ankle = [114, 110];
      const knee = ik(hip, ankle, 26, 24, -1);
      const r = (lean * Math.PI) / 180;
      const S = [hip[0] + 33 * Math.sin(r), hip[1] - 33 * Math.cos(r)];
      const headC = [S[0] + 12 * Math.sin(r), S[1] - 12 * Math.cos(r)];
      return [
        ground(),
        limb([hip, knee, ankle, [132, 114]]),
        limb([S, [S[0] + 17, S[1] + 1], [S[0] + 33, S[1] + 2]]),
        muscle([hip, knee]), capsule(lerp(hip, knee, 0.5), 8, 14, deg(hip, knee)),
        spine([S, hip]), head(headC, 8),
        support(116, 114), support(130, 114),
        breath(lerp(hip, S, 0.55), 8, 10), arrow([76, 112], [76, 70])
      ];
    }
  },

  'prancha-isometrica': {
    A: { S: [168, 79] },
    B: { S: [168, 72] }, // isométrico: o movimento é só "empurrar o chão" (ombros sobem)
    build: ({ S }) => {
      const toe = [42, 108];
      const elbow = [166, 111];
      const hip = lerp(toe, S, 0.5);
      const knee = lerp(toe, S, 0.25);
      return [
        ground(), postureLine(toe, S),
        limb([toe, knee, hip]), limb([S, elbow, [194, 112]]),
        muscle([hip, lerp(hip, S, 0.5)], 9), capsule(lerp(hip, S, 0.3), 15, 14, deg(hip, S)),
        spine([S, hip]), head(add(S, mul(unit(sub(S, hip)), 14))),
        support(166, 113), support(42, 113),
        breath(lerp(hip, S, 0.72), 10, 7), arrow([208, 108], [208, 70])
      ];
    }
  },

  'ponte-gluteos': {
    A: { hip: [98, 106] },
    B: { hip: [98, 88] },
    build: ({ hip }) => {
      const shoulder = [60, 112];
      const foot = [136, 114];
      const knee = ik(hip, foot, 33, 33, -1);
      return [
        ground(), postureLine(shoulder, knee),
        limb([hip, knee, foot]), limb([shoulder, [92, 114]]),
        muscle([hip, knee]), capsule([hip[0] + 2, hip[1] - 2], 6, 14, -30),
        spine([shoulder, hip]), head([44, 108]),
        support(60, 113), support(136, 113),
        breath(lerp(shoulder, hip, 0.5), 8, 7), arrow([100, 84], [100, 46])
      ];
    }
  },

  'quadrupede-cruzado': {
    A: { arm: [[148, 74], [156, 94], [164, 112]], leg: [[104, 74], [100, 94], [84, 106]] },
    B: { arm: [[148, 74], [170, 73], [192, 72]], leg: [[104, 74], [83, 75], [62, 76]] },
    build: ({ arm, leg }) => {
      const shoulder = [148, 74];
      const hip = [104, 74];
      return [
        ground(), postureLine(hip, shoulder, 10),
        limb([shoulder, [150, 114]]), limb([hip, [106, 112], [78, 114]]),
        limb(leg), limb(arm), muscle(leg), muscle(arm, 6),
        capsule([112, 78], 5, 14, 0),
        spine([shoulder, hip]), head([164, 70]),
        support(150, 113), support(106, 113),
        breath([128, 62], 11, 6),
        arrow([58, 76], [36, 76]), arrow([196, 72], [218, 72])
      ];
    }
  },

  'prancha-lateral': {
    A: { hip: [98, 106] },
    B: { hip: [98, 96] },
    build: ({ hip }) => {
      const toe = [46, 110];
      const shoulder = [150, 82];
      const knee = lerp(toe, hip, 0.5);
      return [
        ground(), postureLine(toe, shoulder),
        limb([toe, knee, hip]), limb([shoulder, [150, 111], [124, 113]]), limb([shoulder, [152, 52], [152, 42]]),
        muscle([hip, lerp(hip, shoulder, 0.5)], 9), capsule(lerp(hip, shoulder, 0.3), 10, 14, deg(hip, shoulder)),
        spine([shoulder, hip]), head([164, 77]),
        support(150, 113), support(46, 113),
        breath(lerp(hip, shoulder, 0.7), 9, 7), arrow([98, 90], [98, 58])
      ];
    }
  },

  'elevacao-panturrilha': {
    A: { r: 0 },
    B: { r: 1 },
    build: ({ r }) => {
      const toe = [128, 116];
      const heel = [108 + 2 * r, 116 - 12 * r];
      const ankle = [116, 112 - 12 * r];
      const knee = [117, ankle[1] - 22];
      const hip = [118, ankle[1] - 46];
      const S = [118, hip[1] - 30];
      const hand = [168, 50];
      return [
        ground(), wall(172, 10),
        limb([heel, ankle, toe]), limb([ankle, knee, hip]), limb([S, ik(S, hand, 22, 21, 1), hand]),
        muscle([ankle, knee]), capsule(lerp(ankle, knee, 0.5), 5, 11, 90),
        spine([S, hip]), head([118, S[1] - 11], 7),
        support(128, 115), support(168, 50),
        breath(lerp(S, hip, 0.4), 9, 8), arrow([92, 108], [92, 72])
      ];
    }
  },

  // PRAÇA --------------------------------------------------------------
  'remada-australiana-praca': {
    A: { S: [150, 86] },
    B: { S: [142, 64] },
    build: ({ S }) => {
      const toe = [36, 112];
      const hand = [170, 46];
      const hip = lerp(toe, S, 0.5);
      const knee = lerp(toe, S, 0.27);
      const elbow = ik(S, hand, 21, 20, 1);
      return [
        ground(), line([170, 46], [170, 118]),
        el('circle', { cx: 170, cy: 46, r: 4, stroke: STRUCT, 'stroke-width': 3 }),
        postureLine(toe, S),
        limb([toe, knee, hip]), limb([S, elbow, hand]),
        muscle([S, elbow, hand]), capsule(lerp(hip, S, 0.7), 9, 14, deg(hip, S)),
        spine([S, hip]), head(add(S, mul(unit(sub(S, hip)), 14))),
        support(36, 113), support(170, 46),
        breath(lerp(hip, S, 0.45), 10, 7), arrow([122, 84], [122, 50])
      ];
    }
  },

  'barra-fixa-escapular': {
    A: { sy: 52, hy: 40 },
    B: { sy: 62, hy: 36 }, // ombros descem, longe das orelhas
    build: ({ sy, hy }) => {
      const sL = [105, sy];
      const sR = [135, sy];
      return [
        ground(), line([60, 24], [180, 24]), line([60, 24], [60, 118]), line([180, 24], [180, 118]),
        limb([[100, 24], sL, sR, [140, 24]]), limb([[120, 90], [114, 114]]), limb([[120, 90], [126, 114]]),
        muscle([[100, 24], sL]), muscle([[140, 24], sR]), capsule([120, sy + 10], 8, 14, 0),
        spine([[120, sy - 4], [120, 90]]), head([120, hy], 8),
        support(100, 24), support(140, 24), support(114, 114), support(126, 114),
        breath([120, sy + 16], 9, 7),
        arrow([88, 40], [88, 66]), arrow([152, 40], [152, 66])
      ];
    }
  },

  'afundo-estatico-banco': {
    A: { hip: [94, 70] },
    B: { hip: [96, 86] }, // descida controlada
    build: ({ hip }) => {
      const ankleF = [126, 110];
      const ankleB = [62, 106];
      const kneeF = ik(hip, ankleF, 26, 24, -1);
      const kneeB = ik(hip, ankleB, 26, 24, -1);
      const S = [hip[0], hip[1] - 33];
      const hand = [146, 52];
      return [
        ground(), line([150, 50], [150, 118]), line([140, 52], [160, 52]),
        limb([hip, kneeF, ankleF, [140, 114]]), limb([hip, kneeB, ankleB, [56, 114]]),
        limb([S, ik(S, hand, 18, 17, 1), hand]),
        muscle([hip, kneeF, ankleF]), capsule(lerp(hip, kneeF, 0.5), 8, 14, deg(hip, kneeF)),
        spine([S, hip]), head([S[0], S[1] - 12], 8),
        support(128, 113), support(58, 113), support(146, 52),
        breath(lerp(S, hip, 0.5), 8, 10), arrow([68, 42], [68, 76])
      ];
    }
  },

  'flexao-inclinada-banco': {
    A: { S: [160, 70] },
    B: { S: [164, 47] },
    build: ({ S }) => {
      const ankle = [40, 112];
      const hand = [176, 84];
      const hip = lerp(ankle, S, 0.5);
      const knee = lerp(ankle, S, 0.25);
      return [
        ground(), bench(150, 224, 86), postureLine(ankle, S),
        limb([ankle, knee, hip]), limb([S, ik(S, hand, 21, 20, 1), hand]),
        muscle([S, ik(S, hand, 21, 20, 1), hand]), capsule(add(S, [-6, 6]), 7, 14, deg(hip, S)),
        spine([S, hip]), head(add(S, mul(unit(sub(S, hip)), 14))),
        support(40, 113), support(176, 82),
        breath(lerp(hip, S, 0.5), 12, 8), arrow([204, 78], [204, 44])
      ];
    }
  },

  'subida-no-banco': {
    A: { hip: [128, 72], tAnkle: [112, 112], op: 1 },
    B: { hip: [148, 49], tAnkle: [158, 72], op: 0 },
    build: ({ hip, tAnkle, op }) => {
      const leadAnkle = [148, 90];
      const kneeL = ik(hip, leadAnkle, 22, 20, -1);
      const kneeT = ik(hip, tAnkle, 22, 20, -1);
      const S = [hip[0] + 2, hip[1] - 28];
      const hand = [hip[0] - 4, hip[1] - 4];
      return [
        ground(), bench(120, 196, 96),
        limb([hip, kneeL, leadAnkle, [160, 95]]),
        limb([hip, kneeT, tAnkle, [tAnkle[0] + 8, tAnkle[1] + 4]]),
        limb([S, ik(S, hand, 15, 14, 1), hand]),
        muscle([hip, kneeL, leadAnkle]), capsule(lerp(hip, kneeL, 0.5), 7, 12, deg(hip, kneeL)),
        spine([S, hip]), head([S[0] + 1, S[1] - 11], 7),
        support(150, 95), supportFade([tAnkle[0], tAnkle[1] + 2], op),
        breath(lerp(S, hip, 0.5), 7, 8), arrow([176, 84], [176, 50])
      ];
    }
  },

  'triceps-banco': {
    A: { S: [110, 56], hip: [124, 92] },
    B: { S: [110, 36], hip: [124, 72] },
    build: ({ S, hip }) => {
      const hand = [104, 74];
      const ankle = [154, 106];
      const elbow = ik(S, hand, 19, 19, 1);
      const knee = ik(hip, ankle, 28, 28, -1);
      return [
        ground(), bench(36, 112, 76),
        limb([S, elbow, hand]), limb([hip, knee, ankle, [166, 114]]),
        muscle([S, elbow, hand]), capsule(lerp(S, elbow, 0.5), 6, 12, deg(S, elbow)),
        spine([S, hip]), head([S[0] + 2, S[1] - 13]),
        support(104, 73), support(162, 113),
        breath(lerp(S, hip, 0.4), 8, 9), arrow([186, 104], [186, 68])
      ];
    }
  },

  'joelho-ao-peito-barra': {
    A: { ankle: [120, 118] },
    B: { ankle: [128, 84] },
    build: ({ ankle }) => {
      const hand = [124, 8];
      const S = [118, 40];
      const hip = [118, 72];
      const knee = ik(hip, ankle, 24, 22, -1);
      return [
        ground(), line([124, 8], [190, 8]), line([190, 8], [190, 118]),
        limb([hand, S]), limb([hip, knee, ankle]),
        muscle([hip, knee]), capsule(lerp(S, hip, 0.5), 9, 14, 90),
        spine([S, hip]), head([106, 32], 8),
        support(124, 8),
        breath(lerp(S, hip, 0.45), 8, 6), arrow([164, 102], [164, 70])
      ];
    }
  }
};

const flat = (list) => list.flat(Infinity);

/** SVG animado (A -> B -> A) de todos os exercícios. */
export const buildAllRaw = () =>
  Object.fromEntries(
    Object.entries(poses).map(([id, p]) => [id, wrap(render(flat(p.build(p.A)), flat(p.build(p.B))))])
  );

/** SVG estático numa das posições ('A' ou 'B'); usado só para conferir o desenho. */
export const buildStateRaw = (id, state) => {
  const p = poses[id];
  const list = flat(p.build(p[state]));
  return wrap(render(list, list));
};

/** Lista de elementos (objetos) de uma posição; usada para gerar os arquivos-fonte editáveis. */
export const elementsOf = (id, state = 'A') => flat(poses[id].build(poses[id][state]));
