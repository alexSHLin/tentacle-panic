// ===== 介面、畫面切換、輸入與主迴圈 =====

const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');

const UI = {
  screen: 'title',
  selected: 0,
  ship: { x: 0, y: 0 },
  pointer: { x: 160, y: 120 },
  clock: 0,
  hullShown: -1,
  shownText: {},

  init() {
    const on = (id, fn) => $(id).addEventListener('click', e => {
      Sound.unlock();
      Sound.play('ui');
      e.currentTarget.blur();
      fn();
    });
    on('btn-start', () => this.goMap());
    on('btn-how', () => this.show('how'));
    on('btn-how-close', () => this.show('title'));
    on('btn-lang', () => {
      Save.data.lang = Save.data.lang === 'zh' ? 'en' : 'zh';
      Save.save();
      this.applyLang();
    });
    on('btn-sound', () => {
      Save.data.sound = !Save.data.sound;
      Save.save();
      Sound.setEnabled(Save.data.sound);
      this.applyLang();
    });
    on('btn-map-back', () => this.goTitle());
    on('btn-sail', () => this.startLevel(this.selected));
    on('btn-pause', () => this.pause());
    on('btn-resume', () => this.resume());
    on('btn-restart', () => this.startLevel(Game.index));
    on('btn-pause-map', () => this.goMap());
    on('btn-result-map', () => this.goMap());
    on('btn-retry', () => this.startLevel(Game.index));
    on('btn-next', () => this.startLevel(Game.index + 1));
    on('btn-ending-map', () => this.goMap());
    Game.pointer = this.pointer;
    Game.onEnd = r => this.showResult(r);
    Sound.setEnabled(Save.data.sound);
    this.applyLang();
  },

  applyLang() {
    document.documentElement.lang = Save.data.lang === 'zh' ? 'zh-Hant' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = tr(el.dataset.i18n); });
    $('how-list').innerHTML = tr('howLines').map(line => `<li>${line}</li>`).join('');
    $('btn-sound').textContent = tr(Save.data.sound ? 'soundOn' : 'soundOff');
    this.updateMapInfo();
  },

  show(name) {
    this.screen = name;
    document.querySelectorAll('.screen').forEach(el => el.classList.toggle('hidden', el.id !== 'screen-' + name));
    $('hud').classList.toggle('hidden', !['play', 'pause', 'result'].includes(name));
  },

  banner(text, dur = 1.4) {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;   // 重新觸發動畫
    el.style.animation = `banner ${dur}s ease-out forwards`;
  },

  // ---------- 標題 / 地圖 ----------

  goTitle() {
    this.show('title');
    Sound.playMusic('calm');
  },

  goMap() {
    this.selected = Math.min(Save.data.unlocked, LEVELS.length) - 1;
    const [x, y] = MAP_SPOTS[this.selected];
    this.ship.x = x - 22;
    this.ship.y = y + 4;
    this.show('map');
    this.updateMapInfo();
    Sound.playMusic('calm');
  },

  selectLevel(i) {
    if (i < 0 || i >= LEVELS.length) return;
    if (i >= Save.data.unlocked) { Sound.play('deny'); return; }
    this.selected = i;
    Sound.play('ui');
    this.updateMapInfo();
  },

  mapClick(x, y) {
    const i = MAP_SPOTS.findIndex(([sx, sy]) => ((x - sx) / 22) ** 2 + ((y - sy) / 16) ** 2 <= 1);
    if (i < 0) return;
    if (i === this.selected) this.startLevel(i);   // 再點一次已選的島就出航
    else this.selectLevel(i);
  },

  updateMapInfo() {
    const i = this.selected, cfg = LEVELS[i];
    $('map-name').textContent = `${tr('level')(i + 1)}  ${tr('levelNames')[i]}`;
    const goal = cfg.boss ? tr('bossGoal') : `${tr('target')} ${cfg.target}`;
    $('map-detail').textContent = `${goal} · ${tr('time')} ${cfg.time}${tr('sec')} · ${tr('best')} ${Save.data.best[i] || 0}`;
  },

  // ---------- 遊戲中 ----------

  startLevel(i) {
    const cfg = LEVELS[i];
    Game.start(i);
    this.hullShown = -1;
    this.shownText = {};
    $('hud-level').textContent = `${tr('level')(i + 1)}  ${tr('levelNames')[i]}`;
    $('hud-boss').classList.toggle('hidden', !cfg.boss);
    this.show('play');
    this.banner(`${tr('level')(i + 1)}  ${tr('levelNames')[i]}`, 1.6);
    Sound.stopMusic();
    Sound.playMusic(cfg.boss ? 'boss' : 'shanty');
    if (cfg.boss) {
      Sound.play('roar');
      Game.shake = 4;
    }
    this.updateHud();
  },

  pause() {
    if (this.screen !== 'play' || Game.over) return;
    this.show('pause');
    Sound.stopMusic();
  },

  resume() {
    if (this.screen !== 'pause') return;
    this.show('play');
    Sound.playMusic(Game.cfg.boss ? 'boss' : 'shanty');
  },

  showResult(r) {
    const { newBest, best } = Save.record(r.index, r);
    const cfg = LEVELS[r.index];
    if (r.won && cfg.boss) { this.showEnding(); return; }   // 打倒章魚王 = 全部通關
    const title = $('result-title');
    title.textContent = r.won ? tr(cfg.boss ? 'victory' : 'clear') : tr(r.reason === 'sunk' ? 'failSunk' : 'failTime');
    title.className = r.won ? 'win' : 'lose';
    $('result-stars').innerHTML = [0, 1, 2]
      .map(i => `<img src="${i < r.stars ? Art.urls.star : Art.urls.starEmpty}" alt="">`).join('');
    $('result-score').textContent = `${tr('score')} ${r.score}` + (cfg.boss ? '' : ` / ${cfg.target}`);
    $('result-best').textContent = newBest && r.score > 0 ? tr('newBest') : `${tr('best')} ${best}`;
    $('btn-next').classList.toggle('hidden', !r.won || r.index >= LEVELS.length - 1);
    this.show('result');
  },

  showEnding() {
    this.endStart = this.clock;
    this.endCues = {};
    this.show('ending');
  },

  // 通關畫面的音效時間點
  endingCues(t) {
    const cue = (name, at, fn) => {
      if (t >= at && !this.endCues[name]) { this.endCues[name] = true; fn(); }
    };
    cue('schwing', 0.9, () => Sound.play('schwing'));
    cue('boom', 1.5, () => Sound.play('boom'));
    cue('music', 2.2, () => Sound.playMusic('ending'));
  },

  setText(id, text) {
    if (this.shownText[id] === text) return;
    this.shownText[id] = text;
    $(id).textContent = text;
  },

  updateHud() {
    const g = Game;
    if (g.hull !== this.hullShown) {
      this.hullShown = g.hull;
      $('hud-hull').innerHTML = Array.from({ length: g.hullMax },
        (_, i) => `<img src="${i < g.hull ? Art.urls.heart : Art.urls.heartEmpty}" alt="">`).join('');
    }
    const sec = Math.ceil(g.timeLeft);
    this.setText('hud-time', String(sec));
    $('hud-time').classList.toggle('warn', sec <= 10);
    this.setText('hud-score', g.cfg.boss ? `${tr('score')} ${g.score}` : `${g.score} / ${g.cfg.target}`);
    $('hud-score').classList.toggle('done', !g.cfg.boss && g.score >= g.cfg.target);
    const m = comboMult(g.combo);
    this.setText('hud-combo', g.combo >= 2 ? `${tr('combo')} ${g.combo}` + (m > 1 ? `  x${m}` : '') : '');
    if (g.boss) $('hud-boss-fill').style.width = (g.boss.hp / g.boss.maxHp) * 100 + '%';
  },

  // ---------- 每一幀 ----------

  frame(dt) {
    this.clock += dt;
    if (this.screen === 'play' || this.screen === 'result') {
      const wasReady = Game.ready > 0;
      Game.update(dt);
      if (wasReady && Game.ready <= 0) {
        this.banner(tr('go'), 0.9);
        Sound.play('go');
      }
      this.updateHud();
    }
    if (this.screen === 'title' || this.screen === 'how') {
      drawTitle(ctx, this.clock, this.pointer);
    } else if (this.screen === 'ending') {
      const t = this.clock - this.endStart;
      this.endingCues(t);
      drawEnding(ctx, t);
    } else if (this.screen === 'map') {
      const [x, y] = MAP_SPOTS[this.selected], k = Math.min(1, dt * 4);
      this.ship.x += (x - 22 - this.ship.x) * k;
      this.ship.y += (y + 4 - this.ship.y) * k;
      drawMap(ctx, this.clock, this.selected, this.ship, Save.data);
    } else {
      Game.render(ctx);
    }
  },
};

// ---------- 縮放：保持 320x180 的像素比例 ----------

function resize() {
  let s = Math.min(innerWidth / W, innerHeight / H);
  if (s >= 3) s = Math.floor(s);   // 夠大時用整數倍，像素最銳利
  const stage = $('stage');
  stage.style.width = W * s + 'px';
  stage.style.height = H * s + 'px';
  stage.style.setProperty('--u', s + 'px');
}

function toGame(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

// ---------- 輸入 ----------

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  Sound.unlock();
  const p = toGame(e);
  UI.pointer.x = p.x;
  UI.pointer.y = p.y;
  if (UI.screen === 'play') Game.hitAt(p.x, p.y);
  else if (UI.screen === 'map') UI.mapClick(p.x, p.y);
});

canvas.addEventListener('pointermove', e => {
  const p = toGame(e);
  UI.pointer.x = p.x;
  UI.pointer.y = p.y;
});

document.addEventListener('keydown', e => {
  Sound.unlock();
  if (e.repeat) return;
  const code = e.code, s = UI.screen;
  const confirm = code === 'Enter' || code === 'Space';
  if (s === 'play') {
    if (code in KEY_HOLES) Game.hitHole(KEY_HOLES[code]);
    else if (code === 'Space') Game.hitEyeKey();
    else if (code === 'Escape' || code === 'KeyP') UI.pause();
    else return;
  } else if (s === 'pause') {
    if (code === 'Escape' || code === 'KeyP') UI.resume();
    else return;
  } else if (s === 'map') {
    if (code === 'ArrowLeft') UI.selectLevel(UI.selected - 1);
    else if (code === 'ArrowRight') UI.selectLevel(UI.selected + 1);
    else if (confirm) UI.startLevel(UI.selected);
    else if (code === 'Escape') UI.goTitle();
    else return;
  } else if (s === 'title') {
    if (confirm) UI.goMap();
    else return;
  } else if (s === 'how') {
    if (confirm || code === 'Escape') UI.show('title');
    else return;
  } else if (s === 'ending') {
    if (confirm || code === 'Escape') UI.goMap();
    else return;
  } else if (s === 'result') {
    if (confirm) $('btn-next').classList.contains('hidden') ? UI.startLevel(Game.index) : UI.startLevel(Game.index + 1);
    else if (code === 'Escape') UI.goMap();
    else return;
  }
  e.preventDefault();
});

// 切到別的分頁時自動暫停
document.addEventListener('visibilitychange', () => {
  if (document.hidden) UI.pause();
});

addEventListener('resize', resize);

// ---------- 啟動 ----------

Save.load();
Art.init();
Ending.preloadFont();
UI.init();
resize();

// 網址加上 ?level=5 可直接進入指定關卡，?ending 直接看通關畫面（開發測試用）
const params = new URLSearchParams(location.search);
const startParam = Number(params.get('level'));
if (params.has('ending')) UI.showEnding();
else if (startParam >= 1 && startParam <= LEVELS.length) UI.startLevel(startParam - 1);
else UI.goTitle();

let last = performance.now();
requestAnimationFrame(function loop(now) {
  UI.frame(Math.min(0.05, (now - last) / 1000));
  last = now;
  requestAnimationFrame(loop);
});
