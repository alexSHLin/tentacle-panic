// ===== 像素美術：所有圖像都用程式畫出來，不需要外部圖檔 =====

const W = 320, H = 180, HORIZON = 52;   // 遊戲內部解析度與海平線高度
const TENTACLE_LEN = 26;

// 4x4 Bayer 抖色矩陣：16-bit 遊戲常見的漸層網點效果
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bayer = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;

// 固定種子的亂數，讓背景每次畫出來都一樣
function rng(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function fillEllipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let dy = -ry; dy <= ry; dy++) {
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) ** 2)));
    ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
  }
}

// ---------- 調色盤 ----------

const TENTACLE_PURPLE = { outline: '#2b0f3a', dark: '#5e2378', main: '#8e3fa8', light: '#c86ad8', sucker: '#f3b6d6' };
const TENTACLE_RED = { outline: '#2a0810', dark: '#8a2030', main: '#c03a3a', light: '#e87060', sucker: '#ffc8a8' };
const KRAKEN_PAL = { outline: '#2a0810', dark2: '#5a1420', dark: '#8a2030', main: '#c03a3a', light: '#e87060', spot: '#f0a080' };
const RAIL = { outline: '#2a160a', dark: '#5a3418', main: '#8a5a2e', light: '#b8834a', hl: '#d8a868' };

// 每關的天空與海洋配色（sky / sea 由上往下）
const SKIES = {
  day: {
    sky: ['#3c8ce0', '#5aa8f0', '#8ccaf8', '#c4e8ff'], sea: ['#58b0e8', '#2a7ac8', '#1f5fa8', '#174888'],
    foam: '#e8f8ff', wave: '#8cd0f8', cloud: '#ffffff', cloudShade: '#c8dcf0', clouds: 4,
    sun: { x: 262, y: 18, r: 8, color: '#fff4a0', glow: '#fffbe0' },
  },
  noon: {
    sky: ['#4a88d0', '#78a8e0', '#b0ccea', '#f0e0c0'], sea: ['#5aa0d0', '#2f7cb8', '#22609a', '#1a4a7c'],
    foam: '#f0f4ff', wave: '#90c4e8', cloud: '#fff4e0', cloudShade: '#d8c8b8', clouds: 3,
    sun: { x: 70, y: 22, r: 8, color: '#fff0b0', glow: '#fff8d8' },
  },
  sunset: {
    sky: ['#2e2260', '#7a3478', '#e0605a', '#f8b060'], sea: ['#e08a60', '#8a4a70', '#4a2a5a', '#2a1a40'],
    foam: '#ffd8b0', wave: '#f0a070', cloud: '#f08a80', cloudShade: '#a04a70', clouds: 3,
    sun: { x: 160, y: 48, r: 13, color: '#ffd060', glow: '#ff9a50' }, reflect: '#ffc060',
  },
  night: {
    sky: ['#06061e', '#0e1236', '#18204e', '#243262'], sea: ['#2a3a6a', '#16244a', '#0e1834', '#081024'],
    foam: '#a8c0e8', wave: '#4a6aa0', cloud: '#2a3458', cloudShade: '#1a2240', clouds: 2,
    moon: { x: 250, y: 18, r: 7 }, stars: 50, reflect: '#c8d0f0',
  },
  storm: {
    sky: ['#14141c', '#22222e', '#30303e', '#40404e'], sea: ['#4a5a60', '#2a3a40', '#1c282c', '#10181a'],
    foam: '#c0d0d4', wave: '#6a8088', cloud: '#2a2a36', cloudShade: '#18181f', clouds: 7, rain: true,
  },
};

// ---------- 點陣圖（每個字元代表一個像素，'.' 是透明） ----------

const CAPTAIN_PAL = {
  k: '#1a1020', K: '#2a2a3a', w: '#f0f0f0', y: '#f0c040', s: '#f0b890', e: '#101010',
  b: '#7a4020', R: '#801818', r: '#c03030', g: '#3a2010', n: '#2a3050', B: '#4a2a14',
};
const CAPTAIN_ROWS = [
  '....kkkkkkkk....',
  '...kKKKKKKKKk...',
  '..kKKKKwwKKKKk..',
  '.kKKKKwkkwKKKKk.',
  'kyyyyyyyyyyyyyyk',
  '..kssssssssssk..',
  '..kskkssssessk..',
  '..kssssssssssk..',
  '..kbbssbbssbbk..',
  '..kbbbbbbbbbbk..',
  '...kbbbbbbbbk...',
  '..kRrkbbbbkrRk..',
  '.kRrrrkbbkrrrRk.',
  'kRrrrrrrrrrrrrRk',
  'ksRrrrryyrrrrRsk',
  '.kkRrrrrrrrrRkk.',
  '...kggggyggggk..',
  '...kRrrrrrrrrk..',
  '...knnnnknnnnk..',
  '...knnnk.knnnk..',
  '..kBBBBk.kBBBBk.',
  '..kkkkkk.kkkkkk.',
];

const MERMAID_PAL = {
  k: '#2a1a2e', H: '#ff9a5c', h: '#e8553e', s: '#ffd0a8', S: '#e8a07a', e: '#1a1a40', b: '#ff8aa0',
  m: '#c0405a', c: '#7ae0f0', C: '#3a9ac8', t: '#30b890', T: '#1a7a60', w: '#8ad8ff',
};
const MERMAID_ROWS = [
  '...kkkkkk...',
  '..kHHHHHHk..',
  '.kHhhhhhhhk.',
  '.khsssssshk.',
  '.khsesseshk.',
  '.khbssssbhk.',
  'khhssmmsshhk',
  'khhhkSSkhhhk',
  'khsssssssshk',
  'kssssssssssk',
  'ksccCssccCsk',
  'kskCCssCCksk',
  'kssssssssssk',
  'kSssssssssSk',
  'kttttttttttk',
  'kTttttttttTk',
];
// 被打到時：閉眼、流淚、大哭
const MERMAID_CRY_ROWS = MERMAID_ROWS.map((row, i) =>
  ({ 4: '.khsksskshk.', 5: '.khwsssswhk.', 6: 'khhsmmmmshhk' })[i] || row);

const HEART_ROWS = ['.kk.kk.', 'kwrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
const STAR_ROWS = ['....k....', '...kyk...', '...kyk...', 'kkkyyykkk', 'kyyywyyyk', '.kyyyyyk.', '..kyyyk..', '.kyykyyk.', '.kkk.kkk.'];
const SMALL_STAR_ROWS = ['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.'];

const SPRITE_DEFS = {
  captain: { pal: CAPTAIN_PAL, rows: CAPTAIN_ROWS },
  mermaid: { pal: MERMAID_PAL, rows: MERMAID_ROWS },
  mermaidCry: { pal: MERMAID_PAL, rows: MERMAID_CRY_ROWS },
  mallet: {
    pal: { k: '#2a160a', D: '#7a4a20', y: '#a0a0b0', W: '#e8c890', w: '#c89858' },
    rows: [
      '.....kkk....',
      '.....kDk....',
      '.....kDk....',
      '.....kDk....',
      '.....kDk....',
      '.kkkkkkkkkk.',
      'kyWWWWWWWWyk',
      'kywwwwwwwwyk',
      'kywwwwwwwwyk',
      'kyDDDDDDDDyk',
      '.kkkkkkkkkk.',
    ],
  },
  heart: { pal: { k: '#2a0a10', r: '#e83040', w: '#ffb0b0' }, rows: HEART_ROWS },
  heartEmpty: { pal: { k: '#2a0a10', r: '#4a3a4a', w: '#4a3a4a' }, rows: HEART_ROWS },
  star: { pal: { k: '#3a2008', y: '#ffd040', w: '#fff8c0' }, rows: STAR_ROWS },
  starEmpty: { pal: { k: '#3a2008', y: '#5a4a3a', w: '#5a4a3a' }, rows: STAR_ROWS },
  starSmall: { pal: { y: '#e8a020' }, rows: SMALL_STAR_ROWS },
  starSmallEmpty: { pal: { y: '#b8a070' }, rows: SMALL_STAR_ROWS },
  lock: {
    pal: { k: '#2a1a10', y: '#c0a040' },
    rows: ['..kkk..', '.k...k.', '.k...k.', 'kkkkkkk', 'kyyyyyk', 'kyykyyk', 'kyyyyyk', 'kkkkkkk'],
  },
  ship: {
    pal: { k: '#2a1a10', R: '#d03030', w: '#f4ecd8', b: '#8f5a2e' },
    rows: [
      '......k......',
      '......kRRR...',
      '......kRR....',
      '...wwwkwww...',
      '..wwwwkwwww..',
      '..wwwwkwwww..',
      '......k......',
      'kkkkkkkkkkkkk',
      '.kbbbbbbbbbk.',
      '..kbbbbbbbk..',
      '...kkkkkkk...',
    ],
  },
};

function spriteFromRows(rows, pal) {
  const c = makeCanvas(rows[0].length, rows.length), g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.' && pal[ch]) {
        g.fillStyle = pal[ch];
        g.fillRect(x, y, 1, 1);
      }
    });
  });
  return c;
}

// 3x5 像素數字字型（分數飄字、地圖關卡編號用）
const FONT = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'], 3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '001', '010', '010'],
  8: ['111', '101', '111', '101', '111'], 9: ['111', '101', '111', '001', '111'],
  '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  x: ['000', '101', '010', '101', '000'], '!': ['010', '010', '010', '000', '010'],
};

function drawPixelText(ctx, str, x, y, color, scale = 1, outline = '#1a1020') {
  const x0 = Math.round(x - (str.length * 4 * scale - scale) / 2);
  const pass = (col, ox, oy) => {
    ctx.fillStyle = col;
    [...str].forEach((ch, i) => {
      const glyph = FONT[ch];
      if (!glyph) return;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 3; c++) {
          if (glyph[r][c] === '1') ctx.fillRect(x0 + (i * 4 + c) * scale + ox, y + r * scale + oy, scale, scale);
        }
      }
    });
  };
  if (outline) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pass(outline, ox, oy);
  pass(color, 0, 0);
}

// ---------- 預先繪製的背景 ----------

// 帶抖色過渡的色帶（只在色帶交界處抖色）
function bandColor(cols, f, x, y) {
  const n = cols.length - 1;
  const p = Math.min(n, Math.max(0, f * n));
  const i = Math.floor(p);
  if (i >= n) return cols[n];
  const d = (p - i - 0.7) / 0.3;
  return d > bayer(x, y) ? cols[i + 1] : cols[i];
}

function paintBands(g, w, h, colors) {
  const img = g.createImageData(w, h), cols = colors.map(hexRgb);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = bandColor(cols, y / (h - 1), x, y), i = (y * w + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

// 太陽或月亮，外圈用網點做出光暈
function paintOrb(g, cx, cy, r, color, glow) {
  for (let dy = -r - 4; dy <= r + 4; dy++) {
    for (let dx = -r - 4; dx <= r + 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d <= r) g.fillStyle = color;
      else if (d <= r + 4 && bayer(cx + dx, cy + dy) < 0.5 * (1 - (d - r) / 4)) g.fillStyle = glow;
      else continue;
      g.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}

function buildCloud(r, color, shade) {
  const w = 30 + Math.floor(r() * 24), h = 12 + Math.floor(r() * 6);
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const blobs = [];
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const br = h * (0.35 + r() * 0.3);
    blobs.push([br + r() * (w - 2 * br), h - br, br]);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= br * br)) continue;
      const shaded = y >= h - 2 || (y > h * 0.6 && bayer(x, y) < (y / h - 0.6) * 3);
      g.fillStyle = shaded ? shade : color;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

function buildScene(key) {
  const pal = SKIES[key], r = rng(key.length * 977 + key.charCodeAt(0));

  const sky = makeCanvas(W, HORIZON), sg = sky.getContext('2d');
  paintBands(sg, W, HORIZON, pal.sky);
  for (let i = 0; i < (pal.stars || 0); i++) {
    sg.fillStyle = r() < 0.3 ? '#a0b0ff' : '#ffffff';
    sg.fillRect(Math.floor(r() * W), Math.floor(r() * 40), 1, 1);
  }
  if (pal.sun) paintOrb(sg, pal.sun.x, pal.sun.y, pal.sun.r, pal.sun.color, pal.sun.glow);
  if (pal.moon) {
    paintOrb(sg, pal.moon.x, pal.moon.y, pal.moon.r, '#f0f0d0', '#3a4a7a');
    sg.fillStyle = '#c8c8a8';
    for (const [dx, dy, s] of [[-3, -2, 2], [2, 1, 2], [-1, 3, 1], [3, -3, 1]]) sg.fillRect(pal.moon.x + dx, pal.moon.y + dy, s, s);
  }

  const sea = makeCanvas(W, H - HORIZON), wg = sea.getContext('2d');
  paintBands(wg, W, H - HORIZON, pal.sea);
  wg.fillStyle = pal.foam;
  wg.fillRect(0, 0, W, 1);
  const orb = pal.sun || pal.moon;
  if (pal.reflect && orb) {
    wg.fillStyle = pal.reflect;
    for (let y = 2; y < 60; y += 2) {
      const half = Math.max(1, Math.round((orb.r + 2) * (1 - y / 70) * (0.6 + r() * 0.6)));
      wg.fillRect(orb.x - half + Math.round((r() - 0.5) * 3), y, half * 2, 1);
    }
  }

  const clouds = [];
  for (let i = 0; i < (pal.clouds || 0); i++) {
    clouds.push({ img: buildCloud(r, pal.cloud, pal.cloudShade), x: r() * W, y: 2 + Math.floor(r() * (pal.rain ? 30 : 24)), speed: 2 + r() * 4 });
  }
  const waves = [];
  for (let i = 0; i < 90; i++) {
    const d = r();
    waves.push({
      x: r() * W, y: HORIZON + 2 + Math.floor(d * (H - HORIZON - 30)), len: 2 + Math.floor(d * 8),
      speed: 2 + d * 8, ph: r() * 6.3, color: r() < 0.35 ? pal.foam : pal.wave,
    });
  }
  const rain = pal.rain
    ? Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * H, speed: 160 + r() * 80, len: 3 + Math.floor(r() * 4) }))
    : null;
  return { pal, sky, sea, clouds, waves, rain };
}

// 章魚王的頭（預先算好光影，眼睛在遊戲中即時畫）
function buildKraken(flash) {
  const P = KRAKEN_PAL, w = 84, h = 62, c = makeCanvas(w, h), g = c.getContext('2d');
  const inside = (x, y) =>
    ((x - 42) / 34) ** 2 + ((y - 28) / 28) ** 2 <= 1 || ((x - 42) / 41) ** 2 + ((y - 47) / 14) ** 2 <= 1;
  const spots = [[30, 12, 3], [52, 9, 2], [61, 22, 3], [22, 26, 2], [44, 20, 2], [36, 30, 2]];
  const tones = [P.dark2, P.dark, P.main, P.light];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      let col;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) col = P.outline;
      else if (flash) col = '#ffffff';
      else {
        const light = 0.62 - 0.5 * ((x - 42) / 41) - 0.55 * ((y - 26) / 34);
        col = tones[Math.max(0, Math.min(3, Math.floor(light * 3 + bayer(x, y))))];
        for (const [sx, sy, sr] of spots) if ((x - sx) ** 2 + (y - sy) ** 2 <= sr * sr) col = P.spot;
      }
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  for (const ex of [26, 58]) fillEllipse(g, ex, 44, 8, 7, P.outline);
  g.fillStyle = P.outline;
  for (let i = 0; i < 14; i++) {        // 生氣的眉骨
    const yy = 34 + Math.round(i * 0.3);
    g.fillRect(17 + i, yy, 1, 2);
    g.fillRect(67 - i, yy, 1, 2);
  }
  return c;
}

// 船頭欄杆（畫面最下方）
function buildRail() {
  const c = makeCanvas(W, 28), g = c.getContext('2d');
  const rect = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  for (let x = 2; x < W; x += 14) {
    rect(RAIL.outline, x, 6, 7, 10);
    rect(RAIL.main, x + 1, 6, 5, 10);
    rect(RAIL.light, x + 1, 6, 1, 10);
    rect(RAIL.dark, x + 5, 6, 1, 10);
  }
  rect(RAIL.outline, 0, 0, W, 7);
  rect(RAIL.light, 0, 1, W, 1);
  rect(RAIL.main, 0, 2, W, 3);
  rect(RAIL.dark, 0, 5, W, 1);
  rect(RAIL.outline, 0, 16, W, 12);
  for (let y = 17; y < 28; y += 4) {
    rect(RAIL.dark, 0, y, W, 3);
    rect(RAIL.main, 0, y, W, 1);
  }
  for (let y = 18; y < 28; y += 4) {
    for (let x = 6; x < W; x += 20) rect(RAIL.hl, x + ((y >> 2) & 1) * 10, y, 1, 1);
  }
  return c;
}

// ---------- 航海地圖 ----------

const MAP_SPOTS = [[46, 122], [104, 90], [164, 120], [222, 86], [280, 116]];

function drawIslandBase(g, x, y, boss) {
  fillEllipse(g, x, y + 1, 20, 10, boss ? '#9ab0a8' : '#b8d4c0');
  fillEllipse(g, x, y, 16, 8, boss ? '#1e1e26' : '#6a4a20');
  fillEllipse(g, x, y, 15, 7, boss ? '#4a4a58' : '#e8c878');
  if (boss) {
    fillEllipse(g, x - 2, y - 2, 10, 4, '#6a6a7a');
    g.fillStyle = '#e8e8e0';
    ['.###.', '#.#.#', '#####', '.#.#.'].forEach((row, ry) =>
      [...row].forEach((ch, rx) => ch === '#' && g.fillRect(x - 2 + rx, y - 5 + ry, 1, 1)));
    drawTentacle(g, { cx: x - 13, base: y + 3, len: TENTACLE_LEN, rise: 1, phase: 1, pal: TENTACLE_RED, scale: 0.55 });
    drawTentacle(g, { cx: x + 13, base: y + 3, len: TENTACLE_LEN, rise: 1, phase: 3, pal: TENTACLE_RED, scale: 0.55, flip: true });
    return;
  }
  fillEllipse(g, x - 2, y - 1, 10, 4, '#4a9a3a');
  g.fillStyle = '#6ab84a';
  g.fillRect(x - 8, y - 4, 8, 1);
  // 椰子樹
  g.fillStyle = '#7a4a20';
  for (let i = 0; i < 9; i++) g.fillRect(x + 4 + Math.round(i * 0.25), y - 2 - i, 1, 1);
  g.fillStyle = '#2a7a2a';
  const tx = x + 6, ty = y - 11;
  for (const [dx, dy] of [[-4, 1], [-3, 0], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, 0], [4, 1],
    [-1, 0], [0, 0], [1, 0], [-2, 1], [2, 1], [-5, 2], [5, 2]]) g.fillRect(tx + dx, ty + dy, 1, 1);
}

function drawCompass(g, cx, cy) {
  g.fillStyle = '#6a4a28';
  for (let a = 0; a < 64; a++) {
    const an = (a / 64) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(an) * 10), Math.round(cy + Math.sin(an) * 10), 1, 1);
  }
  for (let i = 0; i < 9; i++) {
    const w = Math.floor((9 - i) / 3);
    g.fillStyle = '#a03020';
    g.fillRect(cx - w, cy - 1 - i, w * 2 + 1, 1);
    g.fillStyle = '#4a3420';
    g.fillRect(cx - w, cy + 1 + i, w * 2 + 1, 1);
  }
  for (let i = 0; i < 7; i++) {
    const w = Math.floor((7 - i) / 3);
    g.fillRect(cx + 1 + i, cy - w, 1, w * 2 + 1);
    g.fillRect(cx - 1 - i, cy - w, 1, w * 2 + 1);
  }
  g.fillStyle = '#a03020';
  ['1001', '1101', '1011', '1001', '1001'].forEach((row, ry) =>
    [...row].forEach((ch, rx) => ch === '1' && g.fillRect(cx - 2 + rx, cy - 18 + ry, 1, 1)));
}

function buildMapBase() {
  const c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(42);
  const img = g.createImageData(W, H);
  const base = [233, 211, 160], mid = [214, 186, 128], dark = [176, 140, 86];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      const v = (e < 16 ? (16 - e) / 16 : 0) + (r() - 0.5) * 0.12;
      const b = bayer(x, y);
      const col = v > 0.55 + b * 0.45 ? dark : v > b * 0.6 ? mid : base;
      const i = (y * W + x) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // 經緯線
  g.fillStyle = '#d4b880';
  for (let x = 8; x < W - 8; x += 2) for (const y of [45, 90, 135]) g.fillRect(x, y, 1, 1);
  for (let y = 8; y < H - 8; y += 2) for (const x of [80, 160, 240]) g.fillRect(x, y, 1, 1);
  // 海浪記號
  g.fillStyle = '#7f9c94';
  for (let i = 0; i < 45; i++) {
    const x = 12 + Math.floor(r() * (W - 30)), y = 20 + Math.floor(r() * (H - 60));
    if (MAP_SPOTS.some(([sx, sy]) => Math.abs(sx - x) < 28 && Math.abs(sy - y) < 18)) continue;
    for (const [dx, dy] of [[0, 0], [1, -1], [2, -1], [3, 0], [4, 0], [5, -1]]) g.fillRect(x + dx, y + dy, 1, 1);
  }
  // 雙線外框
  g.fillStyle = '#6a4a28';
  for (const m of [3, 6]) {
    g.fillRect(m, m, W - m * 2, 1);
    g.fillRect(m, H - m - 1, W - m * 2, 1);
    g.fillRect(m, m, 1, H - m * 2);
    g.fillRect(W - m - 1, m, 1, H - m * 2);
  }
  drawCompass(g, 292, 34);
  MAP_SPOTS.forEach(([x, y], i) => drawIslandBase(g, x, y, i === MAP_SPOTS.length - 1));
  return c;
}

// ---------- 即時繪製的元件 ----------

// 觸手：逐行畫出彎曲、漸粗的形狀，水面以下的部分不畫
function drawTentacle(ctx, o) {
  const s = o.scale || 1, L = Math.round(o.len * s), dir = o.flip ? -1 : 1, P = o.pal;
  const top = Math.round(o.base - L * o.rise), clipY = o.clipY ?? o.base;
  const rows = [];
  for (let j = 0; j < L; j++) {
    const y = top + j;
    if (y >= clipY) break;
    const u = j / L;
    const hw = (0.8 + u * 4.6) * s;
    let ox = Math.sin(o.phase + u * 3.2) * 2.5 * s * (1 - u);
    const curl = 6 * s - j;              // 尖端捲起來
    if (curl > 0) ox += dir * curl * 0.6;
    rows.push([y, Math.round(o.cx + ox - hw), Math.round(o.cx + ox + hw), j]);
  }
  ctx.fillStyle = P.outline;
  for (const [y, xl, xr] of rows) ctx.fillRect(xl - 1, y - 1, xr - xl + 3, 2);
  for (const [y, xl, xr, j] of rows) {
    const w = xr - xl + 1;
    ctx.fillStyle = o.flash ? '#ffffff' : P.main;
    ctx.fillRect(xl, y, w, 1);
    if (o.flash || w < 3) continue;
    ctx.fillStyle = P.light;
    ctx.fillRect(xl, y, 1, 1);
    ctx.fillStyle = P.dark;
    ctx.fillRect(xr, y, 1, 1);
    if (w >= 5 && j % 3 === 1 && j > 4 * s) {   // 吸盤
      const sw = s > 1.2 ? 2 : 1;
      ctx.fillStyle = P.sucker;
      ctx.fillRect(dir > 0 ? xr - 1 - sw : xl + 2, y, sw, 1);
    }
  }
}

function drawSky(ctx, S, t) {
  ctx.drawImage(S.sky, 0, 0);
  for (const c of S.clouds) {
    const span = W + c.img.width;
    ctx.drawImage(c.img, Math.round((c.x + t * c.speed) % span) - c.img.width, c.y);
  }
}

function drawSea(ctx, S, t) {
  ctx.drawImage(S.sea, 0, HORIZON);
  for (const w of S.waves) {
    const v = Math.sin(t * 1.3 + w.ph);
    if (v < -0.2) continue;
    const len = Math.max(1, Math.round((w.len * (v + 0.2)) / 1.2));
    const x = Math.round((w.x + t * w.speed) % (W + 20)) - 10;
    ctx.fillStyle = w.color;
    ctx.fillRect(x, w.y, len, 1);
  }
}

function drawRain(ctx, S, t) {
  ctx.fillStyle = 'rgba(180, 200, 220, 0.5)';
  for (const d of S.rain) {
    const y = ((d.y + t * d.speed) % (H + 10)) - 10;
    const x = (((d.x - y * 0.25) % W) + W) % W;
    ctx.fillRect(Math.round(x), Math.round(y), 1, d.len);
  }
}

function drawWhirlpool(ctx, h, t, pal) {
  const { cx, cy, rx, ry } = h;
  fillEllipse(ctx, cx, cy, rx, ry, pal.sea[3]);
  fillEllipse(ctx, cx, cy, Math.round(rx * 0.55), Math.max(1, Math.round(ry * 0.55)), 'rgba(0, 0, 0, 0.3)');
  ctx.fillStyle = pal.wave;
  for (let k = 0; k < 3; k++) {
    for (let s = 0; s < 1; s += 0.06) {
      const a = k * 2.094 + s * 5 + t * 3, r = 1 - s * 0.85;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rx * r), Math.round(cy + Math.sin(a) * ry * r), 1, 1);
    }
  }
  ctx.fillStyle = pal.foam;
  for (let k = 1; k < 10; k += 2) {
    const a = k * 0.628 - t * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * (rx + 1)), Math.round(cy + Math.sin(a) * (ry + 1)), 2, 1);
  }
}

// 觸手或美人魚冒出時，在水面激起的浪花
function drawFoam(ctx, h, t, pal) {
  const c = h.cr;
  if (!c || c.rise <= 0.05) return;
  ctx.fillStyle = pal.foam;
  for (let i = 0; i < 5; i++) ctx.fillRect(h.cx - 8 + i * 4 + (Math.sin(t * 14 + i * 2) > 0 ? 1 : 0), h.cy - 1, 2, 1);
  if (c.state === 'rising') {
    for (let i = 0; i < 4; i++) ctx.fillRect(h.cx - 6 + i * 4, h.cy - 2 - Math.round(c.rise * (3 + (i % 2) * 3)), 1, 1);
  }
}

// 章魚王噴出的墨汁，會遮住部分畫面
function drawInk(ctx, k) {
  const grow = Math.min(1, (k.max - k.life) / 0.15), fade = Math.min(1, k.life / 0.8);
  const r = Math.round(k.r * grow * fade);
  if (r < 1) return;
  ctx.fillStyle = '#120818';
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy) * (1 + 0.18 * Math.sin(dy * 0.8 + k.seed)));
    ctx.fillRect(Math.round(k.x - hw), Math.round(k.y + dy), hw * 2 + 1, 1);
  }
  const sr = Math.round(r * 0.22) + 1;
  for (let i = 0; i < 5; i++) {
    const a = k.seed + i * 1.3;
    fillEllipse(ctx, Math.round(k.x + Math.cos(a) * r * 1.25), Math.round(k.y + Math.sin(a) * r), sr, sr, '#120818');
  }
  ctx.fillStyle = '#3a2440';
  ctx.fillRect(Math.round(k.x - r * 0.4), Math.round(k.y - r * 0.5), 3, 1);
}

// 敲擊用的木槌：先舉起再落下，打中時冒出星芒
function drawMallet(ctx, m) {
  const p = m.t / 0.22, off = p < 0.3 ? Math.round(-10 * (1 - p / 0.3)) : 0;
  ctx.drawImage(Art.sprites.mallet, Math.round(m.x - 6), Math.round(m.y - 10 + off));
  if (m.hit && p >= 0.3 && p < 0.8) {
    ctx.fillStyle = p < 0.5 ? '#ffffff' : '#ffd040';
    const R = 4 + Math.round((p - 0.3) * 12), x = Math.round(m.x), y = Math.round(m.y);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      ctx.fillRect(x + Math.round(dx * R), y + Math.round(dy * R), 2, 2);
    }
  }
}

function drawCaptain(ctx, t, hop, hurt) {
  if (hurt > 0 && Math.floor(hurt * 16) % 2) return;   // 受傷時閃爍
  const jump = hop > 0 ? Math.round(Math.sin((hop / 0.25) * Math.PI) * 4) : 0;
  ctx.drawImage(Art.sprites.captain, 12, 138 - jump + (Math.sin(t * 2.5) > 0.7 ? 1 : 0));
}

function drawKrakenEye(ctx, x, y, k) {
  if (k.state === 'dying') {
    ctx.fillStyle = '#f8e060';
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(x + i, y + i, 1, 1);
      ctx.fillRect(x + i, y - i, 1, 1);
    }
    return;
  }
  if (k.state === 'spit' || (k.state === 'idle' && k.t % 3.7 < 0.12)) {   // 瞇眼蓄力 / 眨眼
    ctx.fillStyle = '#f8e060';
    ctx.fillRect(x - 5, y, 11, k.state === 'spit' ? 2 : 1);
    return;
  }
  fillEllipse(ctx, x, y, 6, 5, '#f8e060');
  ctx.fillStyle = '#d09a30';
  ctx.fillRect(x - 4, y + 4, 9, 1);
  if (k.state === 'stunned') {
    ctx.fillStyle = '#2a0810';
    for (let i = 0; i < 10; i++) {
      const a = i * 0.9 + k.t * 8, r = i * 0.45;
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.8), 1, 1);
    }
    const rr = 10 + Math.round(Math.sin(k.t * 10) * 1.5);
    for (let i = 0; i < 16; i++) {          // 閃爍的瞄準圈
      if (i % 4 === 3) continue;
      const a = (i / 16) * Math.PI * 2 + k.t * 2;
      ctx.fillStyle = Math.floor(k.t * 8) % 2 ? '#ffffff' : '#ffe040';
      ctx.fillRect(Math.round(x + Math.cos(a) * rr) - 1, Math.round(y + Math.sin(a) * rr) - 1, 2, 2);
    }
    return;
  }
  // 細長瞳孔會盯著滑鼠
  const px = Math.round(Math.max(-1, Math.min(1, (k.pointer.x - x) / 50)) * 2);
  const py = Math.round(Math.max(-1, Math.min(1, (k.pointer.y - y) / 50)) * 1.5);
  ctx.fillStyle = '#100808';
  ctx.fillRect(x - 2 + px, y - 1 + py, 5, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 3, y - 3, 2, 1);
}

// k: { top, t, state, hurt, pointer, sink }
function drawKraken(ctx, k) {
  const sink = k.sink || 0;
  drawTentacle(ctx, { cx: 74, base: HORIZON + 10 + sink, len: 34, rise: 1, phase: k.t * 1.4, pal: TENTACLE_RED, scale: 1.5, clipY: HORIZON + 4 });
  drawTentacle(ctx, { cx: 246, base: HORIZON + 10 + sink, len: 34, rise: 1, phase: k.t * 1.4 + 2, pal: TENTACLE_RED, scale: 1.5, flip: true, clipY: HORIZON + 4 });
  ctx.drawImage(k.hurt > 0 ? Art.krakenFlash : Art.kraken, 118, k.top);
  for (const ex of [144, 176]) drawKrakenEye(ctx, ex, k.top + 44, k);
}

function drawTitle(ctx, t, pointer) {
  const S = Art.scene('sunset');
  drawSky(ctx, S, t);
  drawKraken(ctx, { top: Math.round(Math.sin(t * 1.2) * 2), t, state: 'idle', hurt: 0, pointer });
  drawSea(ctx, S, t);
  drawTentacle(ctx, { cx: 62, base: 152, len: TENTACLE_LEN, rise: 0.8 + Math.sin(t * 1.5) * 0.2, phase: t * 3, pal: TENTACLE_PURPLE });
  drawTentacle(ctx, { cx: 282, base: 152, len: TENTACLE_LEN, rise: 0.8 + Math.sin(t * 1.5 + 2) * 0.2, phase: t * 3 + 1, pal: TENTACLE_PURPLE, flip: true });
  drawCaptain(ctx, t, 0, 0);
  ctx.drawImage(Art.rail, 0, H - 28);
}

function drawMap(ctx, t, sel, ship, progress) {
  ctx.drawImage(Art.mapBase, 0, 0);
  for (let i = 0; i < MAP_SPOTS.length - 1; i++) {     // 航線虛線
    const [x1, y1] = MAP_SPOTS[i], [x2, y2] = MAP_SPOTS[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    ctx.fillStyle = i + 2 <= progress.unlocked ? '#a03020' : '#9a8a6a';
    for (let d = 18; d < len - 18; d++) {
      if (Math.floor(d / 3) % 2 === 0) ctx.fillRect(Math.round(x1 + ((x2 - x1) * d) / len), Math.round(y1 + ((y2 - y1) * d) / len), 1, 1);
    }
  }
  MAP_SPOTS.forEach(([x, y], i) => {
    if (i < progress.unlocked) drawPixelText(ctx, String(i + 1), x, y - 30, i === MAP_SPOTS.length - 1 ? '#ff6050' : '#fff4d0', 2, '#3a2010');
    else ctx.drawImage(Art.sprites.lock, x - 3, y - 28);
    const stars = progress.stars[i] || 0;
    for (let s = 0; s < 3; s++) ctx.drawImage(s < stars ? Art.sprites.starSmall : Art.sprites.starSmallEmpty, x - 9 + s * 6, y + 11);
  });
  const [sx, sy] = MAP_SPOTS[sel];
  ctx.fillStyle = '#c03020';
  for (let i = 0; i < 20; i += 2) {
    const a = (i / 20) * Math.PI * 2 + t;
    ctx.fillRect(Math.round(sx + Math.cos(a) * 21), Math.round(sy + Math.sin(a) * 12), 2, 1);
  }
  ctx.drawImage(Art.sprites.ship, Math.round(ship.x - 6), Math.round(ship.y - 10 + Math.sin(t * 3)));
}

const Art = {
  sprites: {},
  urls: {},
  scenes: {},
  init() {
    for (const [name, def] of Object.entries(SPRITE_DEFS)) this.sprites[name] = spriteFromRows(def.rows, def.pal);
    for (const name of ['heart', 'heartEmpty', 'star', 'starEmpty']) this.urls[name] = this.sprites[name].toDataURL();
    this.kraken = buildKraken(false);
    this.krakenFlash = buildKraken(true);
    this.rail = buildRail();
    this.mapBase = buildMapBase();
  },
  scene(key) {
    return this.scenes[key] || (this.scenes[key] = buildScene(key));
  },
};
