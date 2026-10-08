// ===== 遊戲核心：觸手生成、敲擊判定、章魚王行為與畫面繪製 =====

const ROW_Y = [76, 104, 132];              // 三排漩渦的水面高度
const COL_X = [88, 160, 232];
const POOL = [[12, 4], [14, 5], [16, 5]];  // 每排漩渦大小（遠小近大）

// 鍵盤位置對應 9 個漩渦（以實體按鍵位置判斷）
const KEY_HOLES = {
  KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyZ: 6, KeyX: 7, KeyC: 8,
  Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad1: 6, Numpad2: 7, Numpad3: 8,
};

const comboMult = n => (n >= 15 ? 4 : n >= 10 ? 3 : n >= 5 ? 2 : 1);

const Game = {
  pointer: { x: 160, y: 120 },
  onEnd: null,

  start(index) {
    const cfg = LEVELS[index];
    this.index = index;
    this.cfg = cfg;
    this.scene = Art.scene(cfg.sky);
    this.tentaclePal = cfg.boss ? TENTACLE_RED : TENTACLE_PURPLE;
    this.holes = [];
    ROW_Y.forEach((cy, r) => COL_X.forEach(cx => this.holes.push({ cx, cy, rx: POOL[r][0], ry: POOL[r][1], cr: null })));
    this.score = 0;
    this.combo = 0;
    this.hullMax = cfg.hull;
    this.hull = cfg.hull;
    this.timeLeft = cfg.time;
    this.ready = 1.8;                // 開場倒數
    this.spawnTimer = 0;
    this.clock = 0;
    this.particles = [];
    this.texts = [];
    this.mallets = [];
    this.inks = [];
    this.shake = 0;
    this.flash = 0;
    this.lightning = 0;
    this.thunderTimer = 4;
    this.hop = 0;
    this.hurt = 0;
    this.over = false;
    this.endTimer = 0;
    this.result = null;
    this.boss = cfg.boss
      ? { hp: cfg.bossHp, maxHp: cfg.bossHp, meter: 0, meterMax: 6, state: 'idle', stun: 0, eyeHits: 0,
          inkTimer: 6, spit: 0, rise: 0, dying: 0, hurt: 0, boomTimer: 0 }
      : null;
  },

  // ---------- 更新 ----------

  update(dt) {
    this.clock += dt;
    if (this.ready > 0) this.ready -= dt;
    else if (!this.over) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        if (this.boss) this.finish(false, 'time');
        else this.finish(this.score >= this.cfg.target, 'time');
      }
      this.updateSpawns(dt);
    }
    this.updateHoles(dt);
    if (this.boss) this.updateBoss(dt);
    this.updateEffects(dt);
    if (this.over && this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && this.onEnd) this.onEnd(this.result);
    }
  },

  updateSpawns(dt) {
    const cfg = this.cfg, b = this.boss;
    if (b && b.state === 'stunned') return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const pace = 1 - 0.25 * (1 - this.timeLeft / cfg.time);   // 越接近結束越快
    this.spawnTimer = cfg.spawnEvery * pace * (0.7 + Math.random() * 0.6);
    const free = this.holes.filter(h => !h.cr);
    if (!free.length || this.holes.length - free.length >= cfg.maxActive) return;
    const h = free[Math.floor(Math.random() * free.length)];
    const mermaid = Math.random() < cfg.mermaidChance;
    h.cr = {
      type: mermaid ? 'mermaid' : 'tentacle', state: 'rising', rise: 0, t: 0, flash: 0,
      phase: Math.random() * 6.3, flip: Math.random() < 0.5,
      upTime: cfg.upTime * pace * (mermaid ? 1.3 : 1) * (0.85 + Math.random() * 0.3),
    };
    Sound.play('spawn');
  },

  updateHoles(dt) {
    for (const h of this.holes) {
      const c = h.cr;
      if (!c) continue;
      c.t += dt;
      c.phase += dt * 3;
      c.flash = Math.max(0, c.flash - dt);
      if (this.over && (c.state === 'rising' || c.state === 'up')) c.state = 'sinking';
      if (c.state === 'rising') {
        c.rise += dt / 0.16;
        if (c.rise >= 1) { c.rise = 1; c.state = 'up'; c.t = 0; }
      } else if (c.state === 'up') {
        if (c.t >= c.upTime) {
          c.state = 'sinking';
          if (c.type === 'tentacle') this.tentacleEscaped(h);
        }
      } else if (c.state === 'sinking') {
        c.rise -= dt / 0.2;
      } else if (c.state === 'hit') {
        if (c.t > (c.type === 'mermaid' ? 0.5 : 0.1)) c.rise -= dt / 0.15;
      }
      if (c.state !== 'rising' && c.rise <= 0) h.cr = null;
    }
  },

  updateBoss(dt) {
    const b = this.boss;
    b.hurt = Math.max(0, b.hurt - dt);
    b.rise += ((b.state === 'stunned' ? 1 : 0) - b.rise) * Math.min(1, dt * 6);
    if (b.state === 'stunned') {
      b.stun -= dt;
      if (b.stun <= 0) this.endStun();
    } else if (b.state === 'dying') {
      b.dying = Math.min(1.5, b.dying + dt * 0.5);
      b.boomTimer -= dt;
      if (b.boomTimer <= 0) {
        b.boomTimer = 0.22;
        const top = this.bossTop();
        this.burst(118 + Math.random() * 84, top + 10 + Math.random() * 40, 10, ['#ffffff', '#f8e060', '#c03a3a', '#2a0810'], 70, 120);
        this.shake = Math.max(this.shake, 2);
        Sound.play('boom');
      }
    } else if (!this.over && this.ready <= 0) {
      if (b.state === 'idle') {
        b.inkTimer -= dt;
        if (b.inkTimer <= 0) { b.state = 'spit'; b.spit = 0.7; Sound.play('charge'); }
      } else if (b.state === 'spit') {
        b.spit -= dt;
        if (b.spit <= 0) this.spitInk();
      }
    }
  },

  updateEffects(dt) {
    this.shake = Math.max(0, this.shake - dt * 20);
    this.flash = Math.max(0, this.flash - dt);
    this.hop = Math.max(0, this.hop - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    for (const p of this.particles) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const m of this.texts) { m.y -= 18 * dt; m.t += dt; }
    this.texts = this.texts.filter(m => m.t < 0.8);
    for (const m of this.mallets) m.t += dt;
    this.mallets = this.mallets.filter(m => m.t < 0.22);
    for (const k of this.inks) k.life -= dt;
    this.inks = this.inks.filter(k => k.life > 0);
    if (this.scene.pal.rain) {   // 暴風雨的閃電
      this.lightning = Math.max(0, this.lightning - dt * 4);
      this.thunderTimer -= dt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 5 + Math.random() * 6;
        this.lightning = 1;
        Sound.play('thunder');
      }
    }
  },

  // ---------- 輸入 ----------

  canHit(h) {
    const c = h.cr;
    return !!c && (c.state === 'up' || (c.state === 'rising' && c.rise > 0.35));
  },

  // 滑鼠或觸控（遊戲座標）
  hitAt(x, y) {
    if (this.over || this.ready > 0) return;
    const b = this.boss;
    if (b && b.state === 'stunned') {
      for (const e of this.eyes()) if ((x - e.x) ** 2 + (y - e.y) ** 2 <= 144) return this.hitEye(e);
    }
    for (let i = this.holes.length - 1; i >= 0; i--) {   // 從最前排開始判定
      const h = this.holes[i];
      if (Math.abs(x - h.cx) <= 15 && y >= h.cy - 28 && y <= h.cy + 7 && this.canHit(h)) return this.whack(h, x, y);
    }
    this.miss(x, y);
  },

  // 鍵盤
  hitHole(i) {
    if (this.over || this.ready > 0) return;
    const h = this.holes[i];
    if (this.canHit(h)) this.whack(h, h.cx, h.cy - 12);
    else this.miss(h.cx, h.cy - 2);
  },

  hitEyeKey() {
    const b = this.boss;
    if (this.over || !b || b.state !== 'stunned') return;
    this.hitEye(this.eyes()[b.eyeHits % 2]);
  },

  whack(h, x, y) {
    const c = h.cr;
    c.state = 'hit';
    c.t = 0;
    c.flash = 0.08;
    this.mallets.push({ x, y, t: 0, hit: true });
    if (c.type === 'mermaid') {
      this.combo = 0;
      this.score = Math.max(0, this.score - 15);
      this.popText(h.cx, h.cy - 24, '-15', '#ff6060');
      Sound.play('mermaid');
      this.damage(h.cx);
      return;
    }
    this.combo++;
    const mult = comboMult(this.combo);
    const pts = 10 * mult;
    this.score += pts;
    this.popText(h.cx, h.cy - 30, '+' + pts, mult > 1 ? '#ffd040' : '#ffffff');
    const P = this.tentaclePal;
    this.burst(h.cx, h.cy - 14, 14, [P.main, P.dark, P.sucker, '#1a0820'], 70, 260);
    Sound.play('hit');
    if (mult > comboMult(this.combo - 1)) Sound.play('combo');
    this.shake = Math.max(this.shake, 1.5);
    this.hop = 0.25;
    const b = this.boss;
    if (b && b.state !== 'dying') {
      b.hp -= 1;
      b.meter++;
      b.hurt = 0.1;
      if (b.hp <= 0) this.killBoss();
      else if (b.meter >= b.meterMax && b.state !== 'stunned') this.stunBoss();
    }
  },

  miss(x, y) {
    this.mallets.push({ x, y, t: 0, hit: false });
    this.combo = 0;
    if (y > HORIZON) this.burst(x, y, 6, [this.scene.pal.foam, this.scene.pal.wave], 40, 200, 0.4);
    Sound.play('miss');
  },

  tentacleEscaped(h) {
    this.combo = 0;
    this.burst(h.cx, h.cy, 8, [this.scene.pal.foam, this.scene.pal.wave], 50, 200, 0.4);
    this.damage(h.cx);
  },

  damage(x) {
    if (this.over) return;
    this.hull--;
    this.shake = Math.max(this.shake, 5);
    this.flash = 0.3;
    this.hurt = 0.6;
    Sound.play('damage');
    this.burst(Math.max(20, Math.min(W - 20, x)), 154, 12, ['#8a5a2e', '#b8834a', '#5a3418'], 70, 220);
    if (this.hull <= 0) {
      this.hull = 0;
      this.finish(false, 'sunk');
    }
  },

  // ---------- 章魚王 ----------

  bossTop() {
    const b = this.boss;
    return Math.round(Math.sin(this.clock * 1.2) * 1.5 - b.rise * 7 + b.dying * 16);
  },

  eyes() {
    const y = this.bossTop() + 44;
    return [{ x: 144, y }, { x: 176, y }];
  },

  stunBoss() {
    const b = this.boss;
    b.state = 'stunned';
    b.stun = 4;
    b.eyeHits = 0;
    b.meter = 0;
    for (const h of this.holes) if (h.cr && h.cr.state !== 'hit') h.cr.state = 'sinking';
    Sound.play('stun');
    UI.banner(tr('weakPoint'), 1.6);
  },

  endStun() {
    const b = this.boss;
    b.state = 'idle';
    b.meter = 0;
    b.inkTimer = Math.min(b.inkTimer, 1.5);   // 醒來後馬上反擊
    this.shake = Math.max(this.shake, 3);
    Sound.play('roar');
  },

  hitEye(e) {
    const b = this.boss;
    this.mallets.push({ x: e.x, y: e.y, t: 0, hit: true });
    b.hp -= 4;
    b.eyeHits++;
    b.hurt = 0.15;
    this.score += 30;
    this.popText(e.x, e.y - 14, '+30', '#ffd040');
    this.burst(e.x, e.y, 16, ['#f8e060', '#c03a3a', '#2a0810', '#ffffff'], 80, 240);
    this.shake = Math.max(this.shake, 4);
    this.hop = 0.25;
    Sound.play('eyeHit');
    if (b.hp <= 0) this.killBoss();
    else if (b.eyeHits >= 5) this.endStun();
  },

  killBoss() {
    const b = this.boss;
    b.hp = 0;
    b.state = 'dying';
    b.dying = 0;
    Sound.play('roar');
    this.finish(true, 'boss', 3.2);
  },

  spitInk() {
    const b = this.boss;
    b.state = 'idle';
    b.inkTimer = 7 + Math.random() * 3;
    for (let i = 0; i < 3; i++) {
      this.inks.push({ x: 90 + i * 70 + (Math.random() - 0.5) * 30, y: 66 + Math.random() * 70, r: 14 + Math.random() * 8, life: 4.5, max: 4.5, seed: Math.random() * 10 });
    }
    Sound.play('ink');
  },

  // ---------- 結束 ----------

  finish(won, reason, delay = 1.2) {
    if (this.over) return;
    this.over = true;
    this.endTimer = delay;
    let stars = 0;
    if (won) {
      stars = 1;
      if (this.hull * 2 >= this.hullMax) stars++;
      if (this.cfg.boss ? this.timeLeft >= 30 : this.score >= this.cfg.target * 1.5) stars++;
    }
    this.result = { won, reason, stars, score: this.score, index: this.index };
    Sound.stopMusic();
    if (!won) Sound.play('fail');
    else if (this.cfg.boss) Sound.play('victory', 2.6);
    else Sound.play('clear');
  },

  // ---------- 特效 ----------

  burst(x, y, n, colors, speed = 60, gravity = 200, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.6, g: gravity,
        life: life * (0.6 + Math.random() * 0.4), color: colors[i % colors.length], size: Math.random() < 0.3 ? 2 : 1,
      });
    }
  },

  popText(x, y, str, color) {
    this.texts.push({ x, y, str, color, t: 0 });
  },

  // ---------- 繪圖 ----------

  render(ctx) {
    const t = this.clock, S = this.scene;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(Math.round((Math.random() - 0.5) * this.shake * 2), Math.round((Math.random() - 0.5) * this.shake * 2));
    }
    drawSky(ctx, S, t);
    if (this.boss) {
      const b = this.boss;
      drawKraken(ctx, { top: this.bossTop(), t, state: b.state, hurt: b.hurt, pointer: this.pointer, sink: b.dying * 16 });
    }
    drawSea(ctx, S, t);
    for (const h of this.holes) this.drawHole(ctx, h, t);
    for (const k of this.inks) drawInk(ctx, k);
    drawCaptain(ctx, t, this.hop, this.hurt);
    ctx.drawImage(Art.rail, 0, H - 28);
    for (const p of this.particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    for (const m of this.mallets) drawMallet(ctx, m);
    for (const m of this.texts) drawPixelText(ctx, m.str, Math.round(m.x), Math.round(m.y), m.color);
    if (S.rain) drawRain(ctx, S, t);
    ctx.restore();
    if (this.lightning > 0) this.overlay(ctx, '#e8f0ff', this.lightning * 0.5);
    if (this.flash > 0) this.overlay(ctx, '#ff2020', this.flash);
  },

  overlay(ctx, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  },

  drawHole(ctx, h, t) {
    drawWhirlpool(ctx, h, t, this.scene.pal);
    const c = h.cr;
    if (!c) return;
    if (c.type === 'tentacle') {
      drawTentacle(ctx, { cx: h.cx, base: h.cy, len: TENTACLE_LEN, rise: c.rise, phase: c.phase, pal: this.tentaclePal, flip: c.flip, flash: c.flash > 0 });
    } else {
      // 美人魚只露出水面上的部分
      const spr = c.state === 'hit' ? Art.sprites.mermaidCry : Art.sprites.mermaid;
      const vis = Math.max(0, Math.min(spr.height - 2, Math.round(c.rise * 13 + Math.sin(t * 4 + c.phase))));
      if (vis > 0) ctx.drawImage(spr, 0, 0, spr.width, vis, h.cx - 6, h.cy - vis, spr.width, vis);
    }
    drawFoam(ctx, h, t, this.scene.pal);
  },
};
