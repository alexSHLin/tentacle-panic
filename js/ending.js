// ===== 通關畫面：船長站在金幣山上拔刀，旁邊是寶箱與昏倒的章魚王 =====

const END_TEXT = '台北順起來';
const END_HORIZON = 100, END_SHORE = 128;
const END_SKY = ['#2e2260', '#6a3478', '#c0506a', '#f08060', '#ffc070', '#fff0b0'];
const GOLD = { k: '#3a2008', o: '#b07818', y: '#f0c040', Y: '#fff0a0' };

// ---------- 小工具 ----------

function px(g, col, x, y, w = 1, h = 1) {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
}

// 沿著線段取得像素點
function linePoints(x1, y1, x2, y2) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1), pts = [];
  for (let i = 0; i <= n; i++) pts.push([Math.round(x1 + ((x2 - x1) * i) / n), Math.round(y1 + ((y2 - y1) * i) / n)]);
  return pts;
}

// 把一組 [x, y, 顏色] 畫上去，外圍自動加黑色描邊
function paintOutlined(g, pixels, outline) {
  const key = (x, y) => x + ',' + y, set = new Set(pixels.map(([x, y]) => key(x, y)));
  g.fillStyle = outline;
  for (const [x, y] of pixels) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (!set.has(key(x + dx, y + dy))) g.fillRect(x + dx, y + dy, 1, 1);
    }
  }
  for (const [x, y, col] of pixels) px(g, col, x, y);
}

// ---------- 船長拔刀的三個動作 ----------

const END_CAP = { w: 44, h: 36, ox: 6, oy: 12 };   // 身體在畫布中的位移

function buildEndCaptain(pose) {
  const { w, h, ox, oy } = END_CAP, c = makeCanvas(w, h), g = c.getContext('2d');
  // 右手改成舉起的手臂，所以把原本垂在身側的右手塗成外套
  const rows = CAPTAIN_ROWS.map((row, i) => (i === 14 && pose > 0 ? row.slice(0, 14) + 'RR' : row));
  g.drawImage(spriteFromRows(rows, CAPTAIN_PAL), ox, oy);

  const sx = ox + 13, sy = oy + 12;                       // 右肩
  const hand = [[ox + 14, oy + 16], [ox + 20, oy + 13], [ox + 18, oy + 6]][pose];
  const pixels = [];
  const add = (pts, col, thick) => {
    for (const [x, y] of pts) for (let t = 0; t < thick; t++) pixels.push([x + t, y, col]);
  };
  add(linePoints(sx, sy, hand[0], hand[1]), '#c03030', 3);   // 手臂（紅外套）
  if (pose === 0) {
    add(linePoints(hand[0] + 1, hand[1] + 2, hand[0] + 6, hand[1] + 6), '#4a2a14', 2);   // 刀鞘
  } else {
    const [dx, dy] = pose === 1 ? [10, 1] : [5, -15];
    const blade = linePoints(hand[0] + 1, hand[1] - 1, hand[0] + 1 + dx, hand[1] - 1 + dy);
    blade.forEach(([x, y], i) => {
      pixels.push([x, y, '#f4f8ff']);
      pixels.push(pose === 1 ? [x, y + 1, '#98a8c0'] : [x + 1, y, '#98a8c0']);
      if (i === blade.length - 1) pixels.pop();      // 刀尖收細
    });
  }
  pixels.push([hand[0], hand[1], '#f0b890'], [hand[0] + 1, hand[1], '#f0b890'], [hand[0], hand[1] + 1, '#d89870'], [hand[0] + 1, hand[1] + 1, '#d89870']);
  // 金色護手
  const guard = pose === 1 ? [[hand[0] + 2, hand[1] - 2], [hand[0] + 2, hand[1] - 1], [hand[0] + 2, hand[1]], [hand[0] + 2, hand[1] + 1]]
    : [[hand[0] - 1, hand[1] - 1], [hand[0], hand[1] - 1], [hand[0] + 1, hand[1] - 1], [hand[0] + 2, hand[1] - 1], [hand[0] + 3, hand[1] - 1]];
  for (const [x, y] of guard) pixels.push([x, y, '#f0c040']);
  paintOutlined(g, pixels, '#1a1020');
  return c;
}

// 刀尖位置（給閃光特效用，畫布座標）
function endBladeTip(pose) {
  const { ox, oy } = END_CAP;
  return pose === 1 ? [ox + 31, oy + 13] : [ox + 24, oy - 10];
}

// ---------- 金幣山與寶箱 ----------

function drawCoin(g, x, y, r) {
  const pick = r();
  px(g, GOLD.k, x, y, 4, 3);
  px(g, pick < 0.5 ? GOLD.y : GOLD.o, x, y, 3, 2);
  px(g, GOLD.Y, x, y, 1, 1);
  if (pick > 0.85) px(g, ['#e03040', '#30c070', '#4080f0'][Math.floor(r() * 3)], x + 1, y, 2, 1);   // 寶石
}

function buildMound() {
  const w = 60, h = 22, c = makeCanvas(w, h), g = c.getContext('2d'), r = rng(7);
  const half = y => (w / 2) * Math.pow(Math.max(0, 1 - ((h - y) / h) ** 2.4), 0.5);
  for (let y = 0; y < h; y++) {
    const hw = Math.round(half(y));
    px(g, GOLD.k, w / 2 - hw - 1, y, hw * 2 + 2, 1);
    for (let x = -hw; x < hw; x++) px(g, bayer(x, y) < y / h * 0.8 ? GOLD.o : '#d89a28', w / 2 + x, y);
  }
  const coins = [];
  for (let i = 0; i < 110; i++) {
    const y = Math.floor(r() * (h - 2)), hw = half(y + 1) - 3;
    if (hw > 0) coins.push([Math.round(w / 2 - hw + r() * hw * 2), y]);
  }
  coins.sort((a, b) => a[1] - b[1]).forEach(([x, y]) => drawCoin(g, x, y, r));
  return c;
}

const CHEST_ROWS = [
  '...kkkkkkkkkkkkkk...',
  '..kbbbbbbbbbbbbbbk..',
  '..kbBBBBByyBBBBBbk..',
  '..kkkkkkkkkkkkkkkk..',
  '.kYyyYyrYyyYyuyyYyk.',
  'kyYyyoyyyYyyyoyyYyyk',
  'kyyoyYyyyyogyyyyoyyk',
  'kkkkkkkkkkkkkkkkkkkk',
  'kbbbbbbbbkyykbbbbbbk',
  'kBbbbbbbbkyokbbbbbBk',
  'kBBBBBBBBkkkkBBBBBBk',
  'kbbbbbbbbbbbbbbbbbbk',
  'kBbbbbbbbbbbbbbbbbBk',
  'kBBBBBBBBBBBBBBBBBBk',
  'kkkkkkkkkkkkkkkkkkkk',
];
const CHEST_PAL = {
  k: '#2a1408', b: '#9a5a28', B: '#6a3a18', y: GOLD.y, Y: GOLD.Y, o: GOLD.o,
  r: '#e03040', g: '#30c070', u: '#4080f0',
};

// ---------- 昏倒躺在沙灘上的章魚王 ----------

function buildKrakenKO() {
  const P = KRAKEN_PAL, w = 66, h = 32, c = makeCanvas(w, h), g = c.getContext('2d');
  const tones = [P.dark2, P.dark, P.main, P.light];

  // 軟趴趴的觸手攤在沙灘上
  const limp = (x0, y0, len, dir, ph) => {
    const rows = [];
    for (let i = 0; i < len; i++) {
      const hw = Math.max(0, Math.round(2.2 * (1 - i / len)));
      rows.push([x0 + dir * i, Math.round(y0 + Math.sin(i * 0.4 + ph) * 1.2), hw, i]);
    }
    g.fillStyle = P.outline;
    for (const [x, y, hw] of rows) g.fillRect(x - 1, y - hw - 1, 3, hw * 2 + 3);
    for (const [x, y, hw, i] of rows) {
      px(g, P.main, x, y - hw, 1, hw * 2 + 1);
      px(g, P.light, x, y - hw, 1, 1);
      if (hw >= 1 && i % 3 === 1) px(g, '#ffc8a8', x, y + hw, 1, 1);
    }
  };
  limp(14, 27, 14, -1, 0);
  limp(26, 28, 22, 1, 1.5);
  limp(36, 27, 28, 1, 3);
  limp(18, 29, 10, -1, 2);

  const inside = (x, y) => ((x - 42) / 21) ** 2 + ((y - 15) / 12) ** 2 <= 1 || ((x - 21) / 14) ** 2 + ((y - 20) / 9) ** 2 <= 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      let col;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) col = P.outline;
      else {
        const light = 0.65 - 0.5 * ((x - 34) / 30) - 0.6 * ((y - 14) / 16);
        col = tones[Math.max(0, Math.min(3, Math.floor(light * 3 + bayer(x, y))))];
        for (const [sx, sy, sr] of [[38, 8, 2], [50, 12, 2], [30, 12, 1], [44, 19, 1]]) if ((x - sx) ** 2 + (y - sy) ** 2 <= sr * sr) col = P.spot;
      }
      px(g, col, x, y);
    }
  }
  // 頭上腫一個包
  fillEllipse(g, 40, 3, 3, 2, P.outline);
  fillEllipse(g, 40, 3, 2, 1, P.light);
  // 叉叉眼
  for (const ex of [15, 26]) {
    fillEllipse(g, ex, 18, 4, 3, P.outline);
    for (let i = -2; i <= 2; i++) {
      px(g, '#f8e060', ex + i, 18 + i);
      px(g, '#f8e060', ex + i, 18 - i);
    }
  }
  // 吐舌頭的嘴
  px(g, P.outline, 17, 24, 8, 1);
  px(g, '#f080a0', 19, 25, 3, 2);
  px(g, P.outline, 19, 27, 3, 1);
  return c;
}

// ---------- 背景：雨過天青的金色海灘 ----------

function buildEndBackground() {
  const c = makeCanvas(W, H), g = c.getContext('2d'), r = rng(2026);
  const sky = makeCanvas(W, END_HORIZON);
  paintBands(sky.getContext('2d'), W, END_HORIZON, END_SKY);
  g.drawImage(sky, 0, 0);
  for (let i = 0; i < 14; i++) px(g, '#fff4d0', Math.floor(r() * W), Math.floor(r() * 26));
  paintOrb(g, 150, 96, 18, '#fff4b0', '#ffd080');

  const sea = makeCanvas(W, END_SHORE - END_HORIZON);
  paintBands(sea.getContext('2d'), W, END_SHORE - END_HORIZON, ['#f0a070', '#c06878', '#7a4a80']);
  g.drawImage(sea, 0, END_HORIZON);
  px(g, '#ffe8c0', 0, END_HORIZON, W, 1);
  for (let y = END_HORIZON + 2; y < END_SHORE - 2; y += 2) {
    const half = Math.round(16 * (1 - (y - END_HORIZON) / 40) * (0.6 + r() * 0.5));
    px(g, '#ffd890', 150 - half + Math.round((r() - 0.5) * 4), y, half * 2, 1);
  }

  const sand = makeCanvas(W, H - END_SHORE);
  paintBands(sand.getContext('2d'), W, H - END_SHORE, ['#f0d898', '#e0c078', '#c8a058']);
  g.drawImage(sand, 0, END_SHORE);
  for (let i = 0; i < 120; i++) px(g, r() < 0.5 ? '#b89048' : '#fff0c0', Math.floor(r() * W), END_SHORE + 4 + Math.floor(r() * 48));
  // 散落在沙灘上的金幣
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * W), y = END_SHORE + 14 + Math.floor(r() * 36);
    if (Math.abs(x - 150) < 60 && y < 170) continue;
    drawCoin(g, x, y, r);
  }
  return c;
}

// 「台北順起來」：用字型畫一次後轉成純像素，再加上金色漸層、描邊與陰影
function buildEndText() {
  const fs = 16, tw = fs * END_TEXT.length + 4, th = fs + 4;
  const tmp = makeCanvas(tw, th), tg = tmp.getContext('2d');
  tg.font = `${fs}px 'DotGothic16', 'PingFang TC', 'Microsoft JhengHei', sans-serif`;
  tg.textBaseline = 'top';
  tg.fillStyle = '#000';
  tg.fillText(END_TEXT, 2, 2);
  const a = tg.getImageData(0, 0, tw, th).data;
  const ink = (x, y) => x >= 0 && y >= 0 && x < tw && y < th && a[(y * tw + x) * 4 + 3] > 110;

  const pad = 3, w = tw + pad * 2, h = th + pad * 2, c = makeCanvas(w, h), g = c.getContext('2d');
  const mask = [];
  let top = th, bottom = 0;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) if (ink(x, y)) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
  const bands = ['#fffbe0', '#fff0a0', '#ffd040', '#f0a020', '#d07018'];
  for (let y = -2; y < th + 2; y++) {
    for (let x = -2; x < tw + 2; x++) {
      if (ink(x, y)) continue;
      if (ink(x - 2, y - 2) || ink(x - 1, y - 2) || ink(x - 2, y - 1)) px(g, '#6a1a30', x + pad, y + pad);   // 立體陰影
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        if (ink(x + dx, y + dy)) { px(g, '#2a1408', x + pad, y + pad); break; }
      }
    }
  }
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      if (!ink(x, y)) continue;
      const f = (y - top) / Math.max(1, bottom - top);
      px(g, bands[Math.min(bands.length - 1, Math.floor(f * bands.length + bayer(x, y) * 0.6))], x + pad, y + pad);
      mask.push([x + pad, y + pad]);
    }
  }
  return { img: c, mask };
}

// ---------- 每一幀 ----------

const Ending = {
  built: false,
  build() {
    this.bg = buildEndBackground();
    this.captain = [0, 1, 2].map(buildEndCaptain);
    this.mound = buildMound();
    this.chest = spriteFromRows(CHEST_ROWS, CHEST_PAL);
    this.kraken = buildKrakenKO();
    this.coin = makeCanvas(4, 3);
    drawCoin(this.coin.getContext('2d'), 0, 0, () => 0.2);
    this.sparkles = Array.from({ length: 14 }, (_, i) => [96 + ((i * 37) % 108), 136 + ((i * 13) % 32), i * 0.37]);
    this.built = true;
  },
  // 字型還沒載入完成時先不快取，稍後再試（離線讀不到字型時就用系統字型）
  text() {
    if (this.textArt) return this.textArt;
    const art = buildEndText();
    this.tries = (this.tries || 0) + 1;
    if (!document.fonts || this.tries > 120 || document.fonts.check("16px 'DotGothic16'", END_TEXT)) this.textArt = art;
    return art;
  },
  preloadFont() {
    if (document.fonts) document.fonts.load("16px 'DotGothic16'", END_TEXT).catch(() => {});
  },
};

function drawSparkle(ctx, x, y, R, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - R, y, R * 2 + 1, 1);
  ctx.fillRect(x, y - R, 1, R * 2 + 1);
  if (R > 2) ctx.fillRect(x - 1, y - 1, 3, 3);
}

// 放射狀的光芒，從金幣山後方慢慢旋轉
function drawRays(ctx, t) {
  const cx = 150, cy = 96, n = 14, rot = t * 0.12;
  ctx.fillStyle = 'rgba(255, 240, 180, 0.16)';
  for (let y = 0; y < END_HORIZON; y += 1) {
    for (let x = 0; x < W; x += 2) {
      const a = Math.atan2(y - cy, x - cx) / (Math.PI * 2) * n + rot;
      if (((a % 1) + 1) % 1 < 0.45) ctx.fillRect(x + ((y & 1) ? 1 : 0), y, 1, 1);
    }
  }
}

// t：進入通關畫面後經過的秒數
function drawEnding(ctx, t) {
  const E = Ending;
  if (!E.built) E.build();
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(E.bg, 0, 0);
  drawRays(ctx, t);
  // 海浪與岸邊浪花
  ctx.fillStyle = '#ffe0b0';
  for (let i = 0; i < 24; i++) {
    const v = Math.sin(t * 1.4 + i * 1.7);
    if (v < 0) continue;
    const x = Math.round(((i * 53 + t * (4 + (i % 4))) % (W + 20)) - 10);
    ctx.fillRect(x, END_HORIZON + 3 + ((i * 7) % 22), 2 + Math.round(v * 5), 1);
  }
  const surf = Math.round(Math.sin(t * 1.2) * 2);
  ctx.fillStyle = '#fff8e8';
  for (let x = 0; x < W; x += 3) ctx.fillRect(x, END_SHORE + surf + (Math.sin(x * 0.2 + t * 2) > 0 ? 1 : 0), 2, 1);

  // 「台北順起來」在船長身後落下
  const T = E.text();
  const drop = t < 1.5 ? -1 : Math.min(1, (t - 1.5) / 0.35);
  if (drop >= 0) {
    const bounce = drop < 1 ? -70 * (1 - drop) ** 2 : Math.round(Math.sin(Math.min(1, (t - 1.85) / 0.4) * Math.PI) * -3);
    const S = 3, x = Math.round(150 - (T.img.width * S) / 2), y = Math.round(28 + bounce);
    ctx.drawImage(T.img, x, y, T.img.width * S, T.img.height * S);
    const sweep = ((t - 2.2) % 3.2) * 70 - 10;     // 一道白光掃過文字
    if (t > 2.2) {
      ctx.fillStyle = '#ffffff';
      for (const [mx, my] of T.mask) {
        const d = mx + my * 0.5 - sweep;
        if (d >= 0 && d < 3) ctx.fillRect(x + mx * S, y + my * S, S, S);
      }
    }
  }

  // 寶箱、金幣山、章魚王
  ctx.drawImage(E.chest, 26, 136, E.chest.width * 2, E.chest.height * 2);
  ctx.drawImage(E.kraken, 196, 114, E.kraken.width * 2, E.kraken.height * 2);
  ctx.drawImage(E.mound, 90, 130, E.mound.width * 2, E.mound.height * 2);

  // 從寶箱噴出來的金幣
  for (let i = 0; i < 6; i++) {
    const p = (t * 0.55 + i / 6) % 1, dir = i % 2 ? 1 : -1;
    const cx = 46 + dir * p * (14 + (i % 3) * 8), cy = 140 - Math.sin(p * Math.PI) * (26 + (i % 3) * 6) + p * 22;
    const spin = Math.floor(t * 10 + i) % 4;
    ctx.drawImage(E.coin, Math.round(cx), Math.round(cy), spin === 2 ? 2 : 6, 4);
  }

  // 金幣山上的閃光
  for (const [sx, sy, ph] of E.sparkles) {
    const v = Math.sin(t * 3 + ph * 7);
    if (v > 0.6) drawSparkle(ctx, sx, sy, v > 0.9 ? 2 : 1, '#ffffff');
  }

  // 章魚王頭上轉圈圈的星星
  for (let i = 0; i < 3; i++) {
    const a = t * 3 + (i * Math.PI * 2) / 3;
    const sx = Math.round(236 + Math.cos(a) * 14), sy = Math.round(118 + Math.sin(a) * 4);
    ctx.drawImage(Art.sprites.starSmall, sx, sy);
  }

  // 船長：握刀 → 拔出 → 高舉
  const pose = t < 0.9 ? 0 : t < 1.1 ? 1 : 2;
  const bob = pose === 2 && Math.sin(t * 2.5) > 0.6 ? 1 : 0;
  const cap = E.captain[pose], S = 2;
  const cx = 150 - (END_CAP.ox + 8) * S, cy = 136 - (END_CAP.oy + 22) * S - bob * S;
  ctx.drawImage(cap, cx, cy, cap.width * S, cap.height * S);
  if (pose > 0) {
    const [tx, ty] = endBladeTip(pose);
    const pulse = pose === 1 || t < 1.4 ? 5 : Math.sin(t * 4) > 0.3 ? 3 : 0;
    if (pulse) drawSparkle(ctx, cx + tx * S, cy + ty * S, pulse, '#ffffff');
  }

  // 一開始從白光淡入，拔刀瞬間再閃一下
  const flash = Math.max(1 - t / 0.6, t > 1.1 && t < 1.25 ? 0.35 : 0);
  if (flash > 0) {
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  ctx.imageSmoothingEnabled = prevSmooth;
}
