// Canvas ゲーム(弾幕・ランナー)の共通の土台
//   画面づくり / 操作(キーボード・十字ボタン・画面ドラッグ・タップ) / 60回/秒で一定に進めるループ / 後始末
//
// 使い方:
//   const s = createStage(box, { title, left, right, width, height, pad });
//   s.run(update, draw);      … ゲーム開始(update は1/60秒ごとに呼ばれる)
//   s.destroy();              … 画面を離れるとき(タイマーや操作の登録を全部外す)

const PAD = `
  <div class="dm-pad">
    <i></i><button type="button" data-k="up" aria-label="上">↑</button><i></i>
    <button type="button" data-k="left" aria-label="左">←</button>
    <button type="button" data-k="down" aria-label="下">↓</button>
    <button type="button" data-k="right" aria-label="右">→</button>
  </div>`;

const KEYMAP = {
  ArrowUp: "up", w: "up", ArrowDown: "down", s: "down",
  ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right"
};

// ゲームを一時停止する(確認の窓を出しているあいだなど)。true で止まり、false で動き出す
let paused = false;
export function pauseGames(on) { paused = !!on; }

export function createStage(box, { title, left = "", right = "", width = 800, height = 600, pad = true }) {
  box.innerHTML = `
    <div class="dm">
      <h2 class="dm-title"></h2>
      <div class="dm-info"><span class="dm-left"></span><span class="dm-right"></span></div>
      <div class="dm-msg" aria-live="polite"></div>
      <canvas class="dm-canvas" width="${width}" height="${height}"></canvas>
      ${pad ? PAD : ""}
    </div>`;
  const root = box.firstElementChild;
  const q = sel => root.querySelector(sel);
  q(".dm-title").textContent = title;

  const canvas = q(".dm-canvas");
  const keys = { up: false, down: false, left: false, right: false };
  const timers = [];
  let stopped = false, raf = 0;
  let curMsg = null, curL = null, curR = null;

  const stage = {
    root, canvas, ctx: canvas.getContext("2d"), keys,
    onDrag: null,     // (dx, dy) 画面をなぞったとき(canvas座標での移動量)
    onTap: null,      // 画面をタップしたとき
    onKeyDown: null,  // (event) 好きなキー用
    setInfo(l, r) {
      if (l !== curL) { curL = l; q(".dm-left").textContent = l; }
      if (r !== curR) { curR = r; q(".dm-right").textContent = r; }
    },
    setMessage(t) { if (t !== curMsg) { curMsg = t; q(".dm-msg").textContent = t; } },
    later(fn, ms) { timers.push(setTimeout(fn, ms)); },
    stop() { stopped = true; },
    destroy() {
      stopped = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      box.innerHTML = "";
    },
    run(update, draw) {
      // 一時停止中(確認の窓が出ているあいだ)は、時間を進めない
      const STEP = 1000 / 60;
      let last = performance.now(), acc = 0;
      const tick = now => {
        if (stopped) return;
        if (paused) { last = now; raf = requestAnimationFrame(tick); return; }
        acc += Math.min(now - last, 100);
        last = now;
        while (acc >= STEP && !stopped) { update(); acc -= STEP; }
        draw();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
  };
  stage.setInfo(left, right);

  /* ----- キーボード ----- */
  function onKeyDown(e) {
    const k = KEYMAP[e.key];
    if (k) keys[k] = true;
    if (e.key.startsWith("Arrow") || e.key === " ") e.preventDefault(); // 画面がスクロールしないように
    if (stage.onKeyDown) stage.onKeyDown(e);
  }
  function onKeyUp(e) {
    const k = KEYMAP[e.key];
    if (k) keys[k] = false;
  }
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  /* ----- 十字ボタン ----- */
  root.querySelectorAll(".dm-pad button").forEach(b => {
    const k = b.dataset.k;
    b.addEventListener("pointerdown", e => { e.preventDefault(); keys[k] = true; b.setPointerCapture(e.pointerId); });
    const off = () => { keys[k] = false; };
    b.addEventListener("pointerup", off);
    b.addEventListener("pointercancel", off);
    b.addEventListener("lostpointercapture", off);
    b.addEventListener("contextmenu", e => e.preventDefault());
  });

  /* ----- 画面のタップ・ドラッグ ----- */
  let lastPt = null;
  canvas.addEventListener("pointerdown", e => {
    lastPt = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    if (stage.onTap) stage.onTap(e);
  });
  canvas.addEventListener("pointermove", e => {
    if (!lastPt || !stage.onDrag) return;
    const r = canvas.getBoundingClientRect();
    stage.onDrag((e.clientX - lastPt.x) * (canvas.width / r.width), (e.clientY - lastPt.y) * (canvas.height / r.height));
    lastPt = { x: e.clientX, y: e.clientY };
  });
  const release = () => { lastPt = null; };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  return stage;
}

/* =====================================================================
   かわいい絵の部品(弾幕・ランナーで共通)
   ※ 見た目だけ。当たり判定の大きさ(size など)は、各ゲームの数字のまま
   ===================================================================== */

// 角の丸い四角を「道」として作る(古いブラウザでも動くよう自前で)
export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 毎回同じ並びになる乱数(星の位置などが、遊ぶたびに変わらないように)
function seeded(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 夜空の背景。最初に1回だけ描いておき、毎回はそれを貼るだけ(軽い)
export function makeNightSky(w, h, { tint = "#2b1d5c" } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#120e36"); sky.addColorStop(0.6, tint); sky.addColorStop(1, "#4a2a5e");
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const rnd = seeded(11);
  for (let i = 0; i < 90; i++) {
    g.globalAlpha = 0.3 + rnd() * 0.7;
    g.fillStyle = rnd() < 0.2 ? "#ffd6e2" : "#ffffff";
    g.beginPath(); g.arc(rnd() * w, rnd() * h, 0.6 + rnd() * 1.6, 0, Math.PI * 2); g.fill();
  }
  // 下のほうに、ぼんやり桜色の光
  g.globalAlpha = 1;
  const glow = g.createRadialGradient(w / 2, h * 1.1, 10, w / 2, h * 1.1, h * 0.7);
  glow.addColorStop(0, "rgba(245,163,187,.35)"); glow.addColorStop(1, "rgba(245,163,187,0)");
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  return ctx => ctx.drawImage(c, 0, 0);
}

// 光る玉(弾): 色の玉 + 白いしん
export function drawOrb(ctx, x, y, r, color) {
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
}

// 桜の花びら(自分の弾)
export function drawPetal(ctx, x, y, r, color = "#ffc2d4") {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.75, r * 1.25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.beginPath(); ctx.ellipse(x, y - r * 0.3, r * 0.3, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
}

// ハート(自分)。まん中の白い点が、本当の当たり判定のあたり
export function drawHeart(ctx, x, y, s, color = "#ff8fb1") {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(-s * 1.6, -s * 0.1, -s * 0.8, -s * 1.3, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.8, -s * 1.3, s * 1.6, -s * 0.1, 0, s * 0.9);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// HPバー(丸いかど・グラデーション)
export function drawBar(ctx, x, y, w, h, ratio, colors = ["#ff8fb1", "#f2d479"]) {
  ratio = Math.max(0, Math.min(1, ratio));
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
  if (ratio > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
    roundRectPath(ctx, x, y, Math.max(h, w * ratio), h, h / 2);
    ctx.fillStyle = g; ctx.fill();
  }
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 2; ctx.stroke();
}

// まん中に大きな文字(ふちどり付き)
export function drawBigText(ctx, text, x, y, size = 48, color = "#ffffff", edge = "#e86f8c") {
  ctx.save();
  ctx.font = `bold ${size}px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.lineWidth = size * 0.18; ctx.strokeStyle = edge;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}

// 怨霊(弾幕の敵)。かわいすぎないよう、こわさを出す:
//   長い黒髪 / 赤く光る目 / ギザギザの口と牙 / やぶれた裾 / まわりの暗いオーラ / ただよう人魂(ひとだま)
//   r … 大きさ / frame … 動かす用 / aura … オーラの色 / body・shade … 体の色 / rage … true でもっと怒る(目が大きく光る)
export function drawOnryo(ctx, x, y, r, {
  body = "#eef0ff", shade = "#6e5f99", aura = "rgba(170, 30, 70, .5)", frame = 0, rage = false
} = {}) {
  const t = frame / 60;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2) * r * 0.05); // ゆらり

  // 暗いオーラ(ゆらゆら明るさが変わる)
  ctx.globalAlpha = 0.75 + Math.sin(t * 5) * 0.2;
  const ag = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2);
  ag.addColorStop(0, aura); ag.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ag;
  ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // 人魂(青白い火の玉が3つ、まわりをまわる)
  for (let i = 0; i < 3; i++) {
    const a = t * 0.9 + (i * Math.PI * 2) / 3;
    const hx = Math.cos(a) * r * 1.55, hy = Math.sin(a) * r * 0.9 - r * 0.1;
    const s = r * 0.2 * (1 + Math.sin(t * 7 + i) * 0.12);
    const hg = ctx.createRadialGradient(hx, hy + s * 0.3, 0, hx, hy, s * 2.2);
    hg.addColorStop(0, "rgba(230,250,255,.95)"); hg.addColorStop(0.4, "rgba(120,200,255,.6)"); hg.addColorStop(1, "rgba(80,140,255,0)");
    ctx.fillStyle = hg;
    ctx.beginPath(); // しずくの形(上にのびる炎)
    ctx.moveTo(hx, hy - s * 2.2);
    ctx.quadraticCurveTo(hx + s * 1.4, hy, hx, hy + s);
    ctx.quadraticCurveTo(hx - s * 1.4, hy, hx, hy - s * 2.2);
    ctx.fill();
  }

  // 体(下はやぶれたギザギザの裾)
  const bg = ctx.createLinearGradient(0, -r, 0, r * 1.2);
  bg.addColorStop(0, body); bg.addColorStop(1, shade);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.lineTo(r, r * 0.8);
  const teeth = 6, tw = (r * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const x1 = r - tw * i, sway = Math.sin(t * 4 + i * 1.7) * r * 0.08;
    ctx.lineTo(x1 - tw * 0.5 + sway, r * (1.25 + (i % 2) * 0.12));
    ctx.lineTo(x1 - tw, r * 0.8);
  }
  ctx.closePath();
  ctx.fill();

  // 長い黒髪(頭をおおって、両がわに長くたれる。前髪はギザギザ)
  ctx.fillStyle = "#120a1a";
  ctx.beginPath();
  ctx.arc(0, -r * 0.02, r * 1.06, Math.PI, 0);              // 頭の上
  ctx.lineTo(r * 1.08, r * 0.5);
  for (let i = 0; i < 4; i++) {                              // 右がわの毛先
    const sx = r * (1.08 - i * 0.14), sway = Math.sin(t * 3 + i) * r * 0.06;
    ctx.lineTo(sx - r * 0.05 + sway, r * (1.35 + (i % 2) * 0.2));
    ctx.lineTo(sx - r * 0.14, r * 0.95);
  }
  ctx.lineTo(r * 0.52, -r * 0.05);                           // 顔の右はし
  const bangs = [[0.38, -0.22], [0.25, -0.1], [0.12, -0.26], [0, -0.12], [-0.12, -0.27], [-0.25, -0.1], [-0.38, -0.22]];
  for (const [bx, by] of bangs) ctx.lineTo(bx * r, by * r);   // 前髪
  ctx.lineTo(-r * 0.52, -r * 0.05);                          // 顔の左はし
  ctx.lineTo(-r * 0.52, r * 0.95);
  for (let i = 3; i >= 0; i--) {                             // 左がわの毛先
    const sx = -r * (1.08 - i * 0.14), sway = Math.sin(t * 3 + i + 2) * r * 0.06;
    ctx.lineTo(sx + r * 0.14, r * 0.95);
    ctx.lineTo(sx + r * 0.05 + sway, r * (1.35 + (i % 2) * 0.2));
  }
  ctx.lineTo(-r * 1.08, r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(140, 90, 180, .35)"; ctx.lineWidth = Math.max(1.5, r * 0.03); ctx.stroke(); // 髪のつや

  // 前髪の下の、暗いかげ
  const sh = ctx.createLinearGradient(0, -r * 0.28, 0, r * 0.2);
  sh.addColorStop(0, "rgba(25, 5, 35, .65)"); sh.addColorStop(1, "rgba(25, 5, 35, 0)");
  ctx.fillStyle = sh; ctx.fillRect(-r * 0.52, -r * 0.28, r * 1.04, r * 0.48);

  // 赤く光る目(つり上がった形 + たてに細いひとみ)
  const eyeY = -r * 0.02, eyeX = r * 0.24, glowR = r * (rage ? 0.3 : 0.22);
  ctx.fillStyle = "rgba(60, 20, 70, .45)"; // 目の下のくま
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sx * eyeX, eyeY + r * 0.09, r * 0.13, r * 0.04, 0, 0, Math.PI * 2); ctx.fill(); }
  for (const sx of [-1, 1]) {
    const eg = ctx.createRadialGradient(sx * eyeX, eyeY, 0, sx * eyeX, eyeY, glowR);
    eg.addColorStop(0, "rgba(255,60,80,.85)"); eg.addColorStop(1, "rgba(255,0,40,0)");
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(sx * eyeX, eyeY, glowR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff2a48";
    ctx.beginPath(); ctx.ellipse(sx * eyeX, eyeY, r * 0.13, r * 0.06, sx * -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a0006";
    ctx.beginPath(); ctx.ellipse(sx * eyeX, eyeY, r * 0.025, r * 0.055, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ギザギザの口と牙
  const mw = r * 0.34, my = r * 0.26;
  ctx.fillStyle = "#2a000a";
  ctx.beginPath(); // 口のはしが上がった、不気味な笑い
  ctx.moveTo(-mw, my - r * 0.06);
  ctx.quadraticCurveTo(0, my + r * (rage ? 0.34 : 0.26), mw, my - r * 0.06);
  ctx.quadraticCurveTo(0, my + r * 0.08, -mw, my - r * 0.06);
  ctx.fill();
  ctx.fillStyle = "#fff6f6";
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * mw * 0.55, my + r * 0.04);
    ctx.lineTo(sx * mw * 0.35, my + r * 0.04);
    ctx.lineTo(sx * mw * 0.45, my + r * 0.13);
    ctx.fill();
  }
  ctx.restore();
}
