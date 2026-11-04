// RUN ESCAPE(第四章・崇徳上皇・竹の径)
// 1ボタンで走って、2段ジャンプで障害物をよける。60秒生き延びればクリア。
// 操作: 画面タップ / JUMPボタン / スペース・↑キー
// start(box, onFinish, opts): onFinish("clear" | "fail")。opts.clearTime はテスト用。戻り値は後始末の関数。
import { createStage, roundRectPath, drawBigText } from "./kit.js";

const W = 960, H = 540, GROUND_Y = 450;
const CEILING_TARGET_Y = 135, CEILING_THICKNESS = 15, CEILING_DROP_SPEED = 180, CEILING_BOUNCE_SPEED = 950;
const GRAVITY = 1900;
const rnd = n => Math.floor(Math.random() * n);

const getLevel = t => (t < 15 ? 1 : t < 30 ? 2 : t < 45 ? 3 : 4);
const getSpeed = t => (t < 15 ? 460 : t < 30 ? 520 : t < 45 ? 590 : 680);

export function start(box, onFinish, opts = {}) {
  const CLEAR_TIME = opts.clearTime ?? 60;
  const s = createStage(box, { title: "RUN ESCAPE", width: W, height: H, pad: false });
  const { canvas, ctx } = s;

  let player, obstacles, gameTime, ceilingY, last; // last: 前に作った特殊障害物 "none" | "high" | "long"
  let state = "playing";

  /* ----- 障害物のつくり方(元のC++と同じ数字) ----- */
  const normal = (x, level) => {
    const h = [60, 65, 55, 60][level - 1] + rnd(30);
    return { x, y: GROUND_Y - h, w: 45 + rnd(25), h, type: "ground", kind: "normal" };
  };
  const high = (x, level) => {
    const h = (level <= 2 ? 125 : 115) + rnd(25);
    return { x, y: GROUND_Y - h, w: 50 + rnd(20), h, type: "ground", kind: "high" };
  };
  const long = (x, level) => {
    const w = [150 + rnd(25), 165 + rnd(30), 175 + rnd(30), 185 + rnd(35)][level - 1];
    const h = 55 + rnd(20);
    return { x, y: GROUND_Y - h, w, h, type: "ground", kind: "long" };
  };
  const ceiling = (x, level) => ({
    x, y: CEILING_TARGET_Y + CEILING_THICKNESS, w: 60 + rnd(50),
    h: level === 3 ? 65 + rnd(45) : 75 + rnd(55), type: "ceiling", kind: "normal"
  });

  const furthestX = () => obstacles.reduce((m, o) => Math.max(m, o.x + o.w), W);
  const normalGap = l => [506 + rnd(230), 472 + rnd(206), 483 + rnd(206), 437 + rnd(183)][l - 1];
  const longAfterGap = l => [667 + rnd(161), 644 + rnd(161), 633 + rnd(161), 598 + rnd(184)][l - 1];

  function addEarly(level) {
    const x = furthestX() + (last === "long" ? longAfterGap(level) : normalGap(level));
    if (last === "high" || last === "long") { obstacles.push(normal(x, level)); last = "none"; return; } // 特殊の次は必ず普通
    const r = rnd(100);
    if (r < 55) { obstacles.push(normal(x, level)); last = "none"; }
    else if (r < 80) { obstacles.push(high(x, level)); last = "high"; }
    else { obstacles.push(long(x, level)); last = "long"; }
  }

  function addLate(level) {
    const x = furthestX() + (last === "long" ? longAfterGap(level) : normalGap(level));
    if (last === "high" || last === "long") { obstacles.push(normal(x, level)); last = "none"; return; }
    const r = rnd(100);
    if (r < 25) { obstacles.push(normal(x, level)); last = "none"; }
    else if (r < 40) { obstacles.push(high(x, level)); last = "high"; }
    else if (r < 50) { obstacles.push(long(x, level)); last = "long"; }
    else if (r < 80) { obstacles.push(ceiling(x, level)); last = "none"; }
    else { // 上下セット
      obstacles.push({ x, y: GROUND_Y - (level === 3 ? 80 : 95), w: 75, h: level === 3 ? 80 : 95, type: "ground", kind: "normal" });
      obstacles.push({ x, y: CEILING_TARGET_Y + CEILING_THICKNESS, w: 75, h: level === 3 ? 75 : 90, type: "ceiling", kind: "normal" });
      last = "none";
    }
  }

  function fillCourse() {
    while (furthestX() < W + 2200) {
      if (gameTime < 30) addEarly(getLevel(gameTime)); else addLate(getLevel(gameTime));
    }
  }

  function reset() {
    player = { x: 150, y: 390, w: 40, h: 60, vy: 0, jumps: 0 };
    obstacles = [];
    gameTime = 0;
    ceilingY = -CEILING_THICKNESS;
    last = "none";
    state = "playing";
    fillCourse();
  }

  function jump() {
    if (state !== "playing") return;
    if (player.jumps === 0) { player.vy = -720; player.jumps = 1; }
    else if (player.jumps === 1) { player.vy = -620; player.jumps = 2; }
  }

  function finish(result, delay) {
    s.later(() => onFinish(result), delay);
  }

  function update() {
    if (state !== "playing") return;
    const dt = 1 / 60;
    gameTime += dt;
    if (gameTime >= CLEAR_TIME) { gameTime = CLEAR_TIME; state = "clear"; finish("clear", 1500); return; }

    const level = getLevel(gameTime);
    const speed = getSpeed(gameTime);

    // LEVEL3から天井が降りてくる
    if (level >= 3 && ceilingY < CEILING_TARGET_Y) ceilingY = Math.min(CEILING_TARGET_Y, ceilingY + CEILING_DROP_SPEED * dt);

    // 重力
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;

    // 普通の天井: 当たってもGAME OVERではなく下に落とされる
    if (level >= 3 && player.y < ceilingY + CEILING_THICKNESS) { player.y = ceilingY + CEILING_THICKNESS; player.vy = CEILING_BOUNCE_SPEED; }

    // 地面
    const groundY = GROUND_Y - player.h;
    if (player.y >= groundY) { player.y = groundY; player.vy = 0; player.jumps = 0; }

    // 障害物の移動と当たり判定
    for (const o of obstacles) {
      o.x -= speed * dt;
      if (o.type === "ceiling") o.y = ceilingY + CEILING_THICKNESS; // 紫の障害物は天井に追従
      if (player.x < o.x + o.w && player.x + player.w > o.x && player.y < o.y + o.h && player.y + player.h > o.y) {
        state = "over";
        finish("fail", 1200);
      }
    }
    obstacles = obstacles.filter(o => o.x + o.w >= -100);
    fillCourse();
  }

  /* ----- 描画 ----- */
  const mmss = t => String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(Math.floor(t % 60)).padStart(2, "0");

  // 竹林の背景(遠い竹・近い竹の2まい)。最初に1回だけ描いておき、横にずらして貼る(軽い)
  function makeBamboo(count, color, nodeColor, minW, maxW, alpha, seed) {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    let a = seed;
    const r = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
    g.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const x = r() * W, w = minW + r() * (maxW - minW);
      g.fillStyle = color; g.fillRect(x, 0, w, GROUND_Y);
      g.fillStyle = nodeColor;
      for (let y = 30 + r() * 60; y < GROUND_Y; y += 70 + r() * 30) g.fillRect(x - 1, y, w + 2, 4); // 竹のふし
      // 葉っぱ
      g.fillStyle = color;
      for (let k = 0; k < 3; k++) {
        const ly = 20 + r() * 200, dir = r() < 0.5 ? -1 : 1;
        g.beginPath(); g.ellipse(x + w / 2 + dir * 22, ly, 24, 6, dir * 0.5, 0, Math.PI * 2); g.fill();
      }
    }
    return c;
  }
  const farBamboo = makeBamboo(14, "#cfe9d3", "#b9dcc0", 14, 22, 0.7, 7);
  const nearBamboo = makeBamboo(7, "#a9d9b4", "#8fc89c", 22, 34, 0.75, 21); // 背景はうすめ(障害物を見やすく)
  const scrollLayer = (img, offset) => {
    const x = -(offset % W);
    ctx.drawImage(img, x, 0);
    ctx.drawImage(img, x + W, 0);
  };

  // 障害物: 地面からは竹の切り株、天井からは、むらさきのおばけ
  function drawStump(o) {
    const g = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
    const base = o.kind === "long" ? ["#e9b16b", "#c9803f"] : o.kind === "high" ? ["#5fae74", "#3c8752"] : ["#7cc98f", "#4f9e66"];
    g.addColorStop(0, base[0]); g.addColorStop(1, base[1]);
    roundRectPath(ctx, o.x, o.y, o.w, o.h, 10);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = o.kind === "long" ? "#8a4f22" : "#24603a"; ctx.lineWidth = 4; ctx.stroke(); // こいふちで、背景の竹と見分ける
    ctx.fillStyle = "rgba(0,0,0,.12)"; // ふし
    for (let y = o.y + 28; y < o.y + o.h - 8; y += 30) ctx.fillRect(o.x + 3, y, o.w - 6, 4);
    ctx.fillStyle = o.kind === "long" ? "#ffe2b0" : "#e6f7d9"; // 切り口
    ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + 6, o.w / 2 - 4, 6, 0, 0, Math.PI * 2); ctx.fill();
  }
  function drawCeilingGhost(o) {
    // 天井からたれ下がる怨霊: 黒い髪のすだれの下から、赤い目がのぞく
    const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    g.addColorStop(0, "#2a1838"); g.addColorStop(1, "#6a4a8a");
    roundRectPath(ctx, o.x, o.y - 10, o.w, o.h + 10, 14);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = "#1a0f24"; ctx.lineWidth = 4; ctx.stroke();
    // 髪の毛先(下のはしをギザギザに)
    ctx.fillStyle = "#120a1a";
    ctx.beginPath(); ctx.moveTo(o.x, o.y + o.h - 30);
    for (let x = o.x; x <= o.x + o.w; x += 12) ctx.lineTo(x + 6, o.y + o.h - 14 + ((x / 12) % 2) * 8), ctx.lineTo(x + 12, o.y + o.h - 30);
    ctx.lineTo(o.x + o.w, o.y - 10); ctx.lineTo(o.x, o.y - 10); ctx.closePath(); ctx.fill();
    // 赤く光る目
    const cx = o.x + o.w / 2, cy = o.y + o.h - 38;
    for (const dx of [-11, 11]) {
      const eg = ctx.createRadialGradient(cx + dx, cy, 0, cx + dx, cy, 12);
      eg.addColorStop(0, "rgba(255,60,80,.9)"); eg.addColorStop(1, "rgba(255,0,40,0)");
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(cx + dx, cy, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ff2a48"; ctx.beginPath(); ctx.ellipse(cx + dx, cy, 6, 3, dx < 0 ? 0.4 : -0.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 自分: 桜色の着物の、ちびキャラ(当たり判定は player.w × player.h の四角のまま)
  function drawRunner(p) {
    const cx = p.x + p.w / 2, inAir = p.jumps > 0;
    // 着物
    roundRectPath(ctx, p.x + 2, p.y + 26, p.w - 4, p.h - 26, 10);
    ctx.fillStyle = "#f28aa8"; ctx.fill();
    ctx.fillStyle = "#f2d479"; ctx.fillRect(p.x + 4, p.y + 38, p.w - 8, 5); // 帯
    // 髪(うしろ)
    ctx.fillStyle = "#f5a3bb";
    ctx.beginPath(); ctx.ellipse(cx - 6, p.y + 26, 16, 20, 0, 0, Math.PI * 2); ctx.fill();
    // 顔
    ctx.fillStyle = "#ffeadf";
    ctx.beginPath(); ctx.arc(cx, p.y + 16, 15, 0, Math.PI * 2); ctx.fill();
    // 前髪
    ctx.fillStyle = "#f5a3bb";
    ctx.beginPath(); ctx.arc(cx, p.y + 12, 16, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    // 目(ジャンプ中はにっこり)
    ctx.strokeStyle = ctx.fillStyle = "#3a2350"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (const dx of [-5, 7]) {
      if (inAir) { ctx.beginPath(); ctx.arc(cx + dx, p.y + 18, 3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      else { ctx.beginPath(); ctx.ellipse(cx + dx, p.y + 17, 2.2, 3.2, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = "rgba(255,120,160,.55)";
    ctx.beginPath(); ctx.ellipse(cx - 9, p.y + 22, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 11, p.y + 22, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // 左上・右上の文字(丸いラベルの上に)
  function pill(text, x, y, align) {
    ctx.font = 'bold 26px "Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif';
    const w = ctx.measureText(text).width + 28, left = align === "right" ? x - w : x;
    roundRectPath(ctx, left, y, w, 40, 20);
    ctx.fillStyle = "rgba(255,255,255,.82)"; ctx.fill();
    ctx.strokeStyle = "#f5a3bb"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#7a2d4a"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(text, left + 14, y + 21);
  }

  function draw() {
    // 空 → 竹林(遠い竹はゆっくり、近い竹は速く流れる)
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, "#fff0f5"); sky.addColorStop(1, "#e3f4e6");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    scrollLayer(farBamboo, gameTime * 90);
    scrollLayer(nearBamboo, gameTime * 220);
    // 天井(30秒から)
    if (gameTime >= 30) {
      roundRectPath(ctx, -10, ceilingY, W + 20, CEILING_THICKNESS, 6);
      ctx.fillStyle = "#8a5a3c"; ctx.fill();
    }
    // 地面(草と土)
    ctx.fillStyle = "#9b6b4a"; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#7cc98f"; ctx.fillRect(0, GROUND_Y, W, 12);

    for (const o of obstacles) (o.type === "ceiling" ? drawCeilingGhost : drawStump)(o);
    drawRunner(player);

    if (state === "playing") {
      pill("⏱ " + mmss(gameTime) + " / " + mmss(CLEAR_TIME), 24, 20);
      pill("ジャンプ " + "●".repeat(2 - player.jumps) + "○".repeat(player.jumps), 24, 68);
      pill("LEVEL " + getLevel(gameTime), W - 24, 20, "right");
    } else {
      ctx.fillStyle = state === "over" ? "rgba(90, 30, 70, .6)" : "rgba(255, 190, 210, .6)";
      ctx.fillRect(0, 0, W, H);
      drawBigText(ctx, state === "over" ? "GAME OVER" : "GAME CLEAR!", W / 2, 210, 56,
        "#ffffff", state === "over" ? "#8a4fc9" : "#e86f8c");
      drawBigText(ctx, "TIME  " + mmss(gameTime), W / 2, 290, 30, "#ffffff", "#7a2d4a");
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /* ----- 操作 ----- */
  s.onTap = jump;
  s.onKeyDown = e => { if ((e.key === " " || e.key === "ArrowUp") && !e.repeat) jump(); };
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn main dm-jump";
  btn.textContent = "ジャンプ！";
  btn.addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
  s.root.appendChild(btn);

  reset();
  s.run(update, draw);
  return s.destroy;
}
