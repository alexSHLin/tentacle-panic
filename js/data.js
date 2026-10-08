// ===== 關卡設定、雙語文字與存檔 =====

// 每關設定：
//   time 秒數、target 目標分數、hull 船的耐久度、spawnEvery 觸手出現間隔（秒）、
//   upTime 觸手停留秒數、maxActive 同時最多幾隻、mermaidChance 美人魚出現機率
const LEVELS = [
  { sky: 'day',    time: 40,  target: 150, hull: 5, spawnEvery: 1.10, upTime: 1.70, maxActive: 2, mermaidChance: 0 },
  { sky: 'noon',   time: 45,  target: 250, hull: 6, spawnEvery: 0.95, upTime: 1.45, maxActive: 3, mermaidChance: 0.12 },
  { sky: 'sunset', time: 45,  target: 350, hull: 7, spawnEvery: 0.80, upTime: 1.25, maxActive: 3, mermaidChance: 0.18 },
  { sky: 'night',  time: 50,  target: 500, hull: 8, spawnEvery: 0.65, upTime: 1.05, maxActive: 4, mermaidChance: 0.22 },
  { sky: 'storm',  time: 100, boss: true, bossHp: 80, hull: 8, spawnEvery: 0.85, upTime: 1.25, maxActive: 3, mermaidChance: 0.15 },
];

const TEXT = {
  zh: {
    title: '海盜大戰觸手',
    subtitle: 'TENTACLE PANIC',
    start: '開始遊戲',
    how: '玩法說明',
    lang: 'English',
    soundOn: '音效：開',
    soundOff: '音效：關',
    howTitle: '玩法說明',
    howLines: [
      '點擊或觸碰冒出海面的觸手來敲打它。',
      '鍵盤：Q W E / A S D / Z X C 對應 9 個漩渦。',
      '不要打到美人魚！會扣分又損傷船。',
      '漏掉的觸手會拍打船身，耐久度歸零就沉船。',
      '連續命中可累積連擊，最高 4 倍得分。',
      '章魚王暈眩時，敲牠的眼睛（或按空白鍵）。',
    ],
    close: '知道了',
    mapTitle: '航海地圖',
    back: '返回',
    sail: '出航！',
    target: '目標',
    time: '時間',
    best: '最高分',
    sec: '秒',
    level: n => `第 ${n} 關`,
    levelNames: ['平靜海灣', '珊瑚淺灘', '夕陽海峽', '月夜迷霧', '章魚王的巢穴'],
    bossGoal: '擊敗章魚王',
    score: '分數',
    paused: '暫停',
    resume: '繼續',
    restart: '重新開始',
    toMap: '回到地圖',
    clear: '過關！',
    victory: '章魚王被擊敗了！',
    failTime: '時間到…',
    failSunk: '船沉了…',
    next: '下一關',
    retry: '再試一次',
    newBest: '新紀錄！',
    go: '開戰！',
    weakPoint: '打牠的眼睛！',
    bossName: '章魚王',
    rotate: '請將手機橫放以獲得最佳體驗',
    combo: '連擊',
  },
  en: {
    title: 'TENTACLE PANIC',
    subtitle: '海盜大戰觸手',
    start: 'START',
    how: 'HOW TO PLAY',
    lang: '中文',
    soundOn: 'SOUND: ON',
    soundOff: 'SOUND: OFF',
    howTitle: 'How to Play',
    howLines: [
      'Click or tap the tentacles to whack them.',
      'Keyboard: Q W E / A S D / Z X C match the 9 whirlpools.',
      "Don't hit the mermaid! It costs points and hull.",
      'Missed tentacles slam the ship. Hull at zero = sunk.',
      'Chain hits for a combo, up to x4 points.',
      'When the Kraken is stunned, hit its eyes (or press Space).',
    ],
    close: 'GOT IT',
    mapTitle: 'Sea Chart',
    back: 'BACK',
    sail: 'SET SAIL!',
    target: 'Target',
    time: 'Time',
    best: 'Best',
    sec: 's',
    level: n => `Stage ${n}`,
    levelNames: ['Calm Cove', 'Coral Shoals', 'Sunset Strait', 'Moonlit Mist', "Kraken's Lair"],
    bossGoal: 'Defeat the Kraken',
    score: 'Score',
    paused: 'PAUSED',
    resume: 'RESUME',
    restart: 'RESTART',
    toMap: 'MAP',
    clear: 'STAGE CLEAR!',
    victory: 'THE KRAKEN IS DEFEATED!',
    failTime: "TIME'S UP...",
    failSunk: 'YOUR SHIP SANK...',
    next: 'NEXT',
    retry: 'RETRY',
    newBest: 'NEW RECORD!',
    go: 'WHACK!',
    weakPoint: 'HIT THE EYES!',
    bossName: 'KRAKEN',
    rotate: 'Rotate your phone to landscape',
    combo: 'COMBO',
  },
};

// 存檔：語言、音效開關、解鎖進度、每關最高分與星數（存在瀏覽器 localStorage）
const Save = {
  KEY: 'tentacle-panic-v1',
  data: {
    lang: (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en',
    sound: true,
    unlocked: 1,
    best: [],
    stars: [],
  },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* 無痕模式等情況讀不到存檔，就用預設值 */ }
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* 忽略 */ }
  },
  // 記錄一局結果，回傳是否破紀錄
  record(index, result) {
    const d = this.data;
    const prev = d.best[index] || 0;
    const newBest = result.score > prev;
    if (newBest) d.best[index] = result.score;
    if (result.won) {
      d.stars[index] = Math.max(d.stars[index] || 0, result.stars);
      d.unlocked = Math.min(LEVELS.length, Math.max(d.unlocked, index + 2));
    }
    this.save();
    return { newBest, best: Math.max(prev, result.score) };
  },
};

// 取得目前語言的文字
function tr(key) {
  const v = TEXT[Save.data.lang][key];
  return v !== undefined ? v : TEXT.zh[key];
}
