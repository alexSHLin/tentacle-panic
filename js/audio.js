// ===== 晶片音效與配樂：用 Web Audio 即時合成，不需要音檔 =====

function noteFreq(name) {
  const m = /^([A-G])(#?)(-?\d)$/.exec(name);
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 樂譜格式："音名:長度"，長度以 16 分音符為單位，"-" 是休止符
function parseTrack(str) {
  const map = {};
  let step = 0;
  for (const tok of str.trim().split(/\s+/)) {
    const [n, len] = tok.split(':');
    if (n !== '-') map[step] = { freq: noteFreq(n), len: Number(len) };
    step += Number(len);
  }
  return { map, length: step };
}

// 水手歌〈What Shall We Do with the Drunken Sailor〉（傳統民謠）
const SHANTY_VERSE =
  'A4:2 A4:1 A4:1 A4:2 A4:1 A4:1 A4:2 D4:2 F4:2 A4:2 ' +
  'G4:2 G4:1 G4:1 G4:2 G4:1 G4:1 G4:2 C4:2 E4:2 G4:2 ' +
  'A4:2 A4:1 A4:1 A4:2 A4:1 A4:1 A4:2 B4:2 C5:2 D5:2 ' +
  'C5:2 A4:2 G4:2 E4:2 D4:4 D4:4 ';
const SHANTY_CHORUS =
  'A4:4 A4:4 A4:2 D4:2 F4:2 A4:2 ' +
  'G4:4 G4:4 G4:2 C4:2 E4:2 G4:2 ' +
  'A4:4 A4:4 A4:2 B4:2 C5:2 D5:2 ' +
  'C5:2 A4:2 G4:2 E4:2 D4:4 D4:4 ';
const SHANTY_BASS =
  'D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 ' +
  'C3:2 G2:2 C3:2 G2:2 C3:2 G2:2 C3:2 G2:2 ' +
  'D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 D3:2 A2:2 ' +
  'C3:2 G2:2 C3:2 G2:2 D3:2 A2:2 D3:4 ';

const SONGS = {
  calm: {
    bpm: 100,
    tracks: [
      { type: 'triangle', vol: 0.12, notes: SHANTY_VERSE },
      { type: 'triangle', vol: 0.1, notes: 'D3:8 A2:8 C3:8 G2:8 D3:8 A2:8 C3:8 D3:8' },
    ],
  },
  shanty: {
    bpm: 150,
    drums: 'k.h.s.h.k.h.s.hh',
    tracks: [
      { type: 'square', vol: 0.06, notes: SHANTY_VERSE + SHANTY_CHORUS },
      { type: 'triangle', vol: 0.16, notes: SHANTY_BASS },
    ],
  },
  boss: {
    bpm: 168,
    drums: 'k.hkk.s.k.hks.sh',
    tracks: [
      { type: 'square', vol: 0.05, notes: 'D5:4 -:2 A4:2 C5:4 A#4:2 A4:2 G4:2 A4:2 A#4:2 A4:2 F4:4 E4:4 D5:4 -:2 A4:2 F5:4 E5:2 D5:2 C#5:4 A4:4 D5:8' },
      {
        type: 'square', vol: 0.06,
        notes: 'D2:2 D3:2 D2:2 D3:2 F2:2 F3:2 E2:2 E3:2 D2:2 D3:2 D2:2 D3:2 F2:2 F3:2 E2:2 E3:2 ' +
               'D2:2 D3:2 D2:2 D3:2 A#1:2 A#2:2 A1:2 A2:2 D2:2 D3:2 D2:2 D3:2 A#1:2 A#2:2 A1:2 A2:2',
      },
    ],
  },
};

// 各種音效（s = Sound，d = 延遲秒數）
const SFX = {
  hit: (s, d) => { s.tone({ freq: 520, to: 140, dur: 0.09, vol: 0.22, delay: d }); s.noise({ dur: 0.07, vol: 0.3, freq: 3000, delay: d }); },
  eyeHit: (s, d) => {
    s.tone({ freq: 300, to: 60, dur: 0.22, vol: 0.3, delay: d });
    s.noise({ dur: 0.18, vol: 0.4, freq: 1500, delay: d });
    s.tone({ type: 'triangle', freq: 900, to: 1800, dur: 0.08, vol: 0.15, delay: d + 0.02 });
  },
  miss: (s, d) => { s.noise({ dur: 0.16, vol: 0.18, freq: 1400, delay: d }); s.tone({ type: 'sine', freq: 320, to: 120, dur: 0.1, vol: 0.1, delay: d }); },
  spawn: (s, d) => s.tone({ type: 'sine', freq: 180, to: 420, dur: 0.08, vol: 0.06, delay: d }),
  mermaid: (s, d) => {
    s.tone({ freq: 1200, to: 1500, dur: 0.08, vol: 0.12, delay: d });
    s.tone({ freq: 1000, to: 1300, dur: 0.08, vol: 0.12, delay: d + 0.1 });
  },
  damage: (s, d) => { s.tone({ type: 'sawtooth', freq: 160, to: 45, dur: 0.35, vol: 0.28, delay: d }); s.noise({ dur: 0.3, vol: 0.35, freq: 800, delay: d }); },
  combo: (s, d) => [660, 880, 1320].forEach((f, i) => s.tone({ freq: f, dur: 0.07, vol: 0.1, delay: d + i * 0.05 })),
  stun: (s, d) => {
    s.tone({ freq: 300, to: 1200, dur: 0.4, vol: 0.14, delay: d });
    s.tone({ type: 'triangle', freq: 1200, to: 600, dur: 0.25, vol: 0.14, delay: d + 0.4 });
  },
  roar: (s, d) => {
    s.tone({ type: 'sawtooth', freq: 95, to: 50, dur: 0.9, vol: 0.28, delay: d });
    s.tone({ type: 'square', freq: 70, to: 40, dur: 0.9, vol: 0.12, delay: d });
    s.noise({ dur: 0.9, vol: 0.22, freq: 500, delay: d });
  },
  charge: (s, d) => s.tone({ type: 'sawtooth', freq: 120, to: 360, dur: 0.6, vol: 0.12, delay: d }),
  ink: (s, d) => { s.noise({ dur: 0.3, vol: 0.35, freq: 600, delay: d }); s.tone({ type: 'sine', freq: 240, to: 70, dur: 0.3, vol: 0.2, delay: d }); },
  boom: (s, d) => { s.noise({ dur: 0.35, vol: 0.3, freq: 700, delay: d }); s.tone({ freq: 120, to: 40, dur: 0.25, vol: 0.14, delay: d }); },
  thunder: (s, d) => s.noise({ dur: 1.4, vol: 0.45, freq: 260, delay: d }),
  ui: (s, d) => s.tone({ freq: 880, dur: 0.05, vol: 0.08, delay: d }),
  deny: (s, d) => s.tone({ freq: 160, dur: 0.12, vol: 0.12, delay: d }),
  go: (s, d) => { s.tone({ freq: 523, dur: 0.1, vol: 0.12, delay: d }); s.tone({ freq: 784, dur: 0.18, vol: 0.12, delay: d + 0.1 }); },
  clear: (s, d) => {
    [523, 659, 784, 1047].forEach((f, i) => s.tone({ freq: f, dur: i === 3 ? 0.45 : 0.12, vol: 0.14, delay: d + i * 0.12 }));
    s.tone({ type: 'triangle', freq: 262, dur: 0.8, vol: 0.18, delay: d });
  },
  fail: (s, d) => [392, 330, 262, 196].forEach((f, i) =>
    s.tone({ freq: f, to: f * 0.97, dur: i === 3 ? 0.6 : 0.2, vol: 0.13, delay: d + i * 0.22 })),
  victory: (s, d) => {
    const notes = [523, 523, 523, 659, 784, 659, 784, 1047];
    const lens = [0.1, 0.1, 0.1, 0.25, 0.15, 0.1, 0.15, 0.6];
    let at = 0;
    notes.forEach((f, i) => {
      s.tone({ freq: f, dur: lens[i], vol: 0.14, delay: d + at });
      s.tone({ type: 'triangle', freq: f / 2, dur: lens[i], vol: 0.14, delay: d + at });
      at += lens[i] + 0.02;
    });
  },
};

const Sound = {
  ctx: null,
  enabled: true,
  song: null,
  pending: null,
  timer: null,

  // 瀏覽器規定要在使用者第一次點擊或按鍵後才能發出聲音
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      this.master.connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = 0.5;
      this.musicBus.connect(this.master);
      const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.setEnabled(this.enabled);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.pending) {
      const name = this.pending;
      this.pending = null;
      this.playMusic(name);
    }
  },

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.value = on ? 0.6 : 0;
  },

  tone(o) {
    const c = this.ctx, at = o.at ?? c.currentTime + (o.delay || 0), dur = o.dur || 0.1;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, at);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(o.bus || this.sfxBus);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  },

  noise(o) {
    const c = this.ctx, at = o.at ?? c.currentTime + (o.delay || 0), dur = o.dur || 0.1;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.freq || 2000;
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol || 0.2, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.bus || this.sfxBus);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  },

  play(name, delay = 0) {
    if (!this.ctx || !this.enabled) return;
    const fx = SFX[name];
    if (fx) fx(this, delay);
  },

  playMusic(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.song && this.song.name === name) return;
    this.stopMusic();
    const def = SONGS[name];
    this.song = {
      name, def, step: 0, next: this.ctx.currentTime + 0.1,
      tracks: def.tracks.map(tk => ({ ...tk, ...parseTrack(tk.notes) })),
    };
    this.timer = setInterval(() => this.schedule(), 25);
  },

  stopMusic() {
    clearInterval(this.timer);
    this.timer = null;
    this.song = null;
    this.pending = null;
  },

  // 提前排程接下來 0.15 秒內的音符
  schedule() {
    const s = this.song, c = this.ctx;
    if (!s) return;
    const stepDur = 60 / s.def.bpm / 4, bus = this.musicBus;
    if (s.next < c.currentTime - 0.2) s.next = c.currentTime + 0.05;   // 分頁在背景時跳過積欠的音符
    while (s.next < c.currentTime + 0.15) {
      for (const tk of s.tracks) {
        const ev = tk.map[s.step % tk.length];
        if (ev) this.tone({ type: tk.type, freq: ev.freq, dur: ev.len * stepDur * 0.9, vol: tk.vol, at: s.next, bus });
      }
      const drums = s.def.drums;
      if (drums) {
        const ch = drums[s.step % drums.length];
        if (ch === 'k') this.tone({ type: 'sine', freq: 150, to: 40, dur: 0.12, vol: 0.3, at: s.next, bus });
        else if (ch === 's') this.noise({ dur: 0.1, vol: 0.18, freq: 2500, at: s.next, bus });
        else if (ch === 'h') this.noise({ dur: 0.03, vol: 0.06, freq: 7000, filter: 'highpass', at: s.next, bus });
      }
      s.next += stepDur;
      s.step++;
    }
  },
};
