// RUN ESCAPE(第四章・崇徳上皇・竹の径)
// 1ボタンで走って、2段ジャンプで障害物をよける。60秒生き延びればクリア。
// 操作: 画面タップ / JUMPボタン / スペース・↑キー
// start(box, onFinish, opts): onFinish("clear" | "fail")。opts.clearTime はテスト用。戻り値は後始末の関数。
import { createStage } from "./kit.js";

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
  const COLORS = { normal: "rgb(220,50,50)", high: "rgb(190,40,40)", long: "rgb(230,120,30)" };

  function draw() {
    ctx.fillStyle = "rgb(235,240,245)"; ctx.fillRect(0, 0, W, H);
    if (gameTime >= 30) { ctx.fillStyle = "rgb(60,60,70)"; ctx.fillRect(0, ceilingY, W, CEILING_THICKNESS); }
    ctx.fillStyle = "rgb(50,50,50)"; ctx.fillRect(0, GROUND_Y, W, 12);

    for (const o of obstacles) {
      ctx.fillStyle = o.type === "ceiling" ? "rgb(170,50,210)" : COLORS[o.kind];
      ctx.fillRect(o.x, o.y, o.w, o.h);
    }
    ctx.fillStyle = "rgb(50,100,255)";
    ctx.fillRect(player.x, player.y, player.w, player.h);

    ctx.font = "bold 28px Arial, sans-serif";
    ctx.textBaseline = "top";
    if (state === "playing") {
      ctx.fillStyle = "rgb(20,20,20)";
      ctx.textAlign = "left";
      ctx.fillText("TIME  " + mmss(gameTime) + " / " + mmss(CLEAR_TIME), 30, 25);
      ctx.fillText("JUMP " + (2 - player.jumps), 30, 65);
      ctx.textAlign = "right";
      ctx.fillText("LEVEL " + getLevel(gameTime), W - 30, 25);
    } else {
      ctx.fillStyle = state === "over" ? "rgba(150,0,0,0.67)" : "rgba(0,150,70,0.67)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.font = "bold 52px Arial, sans-serif";
      ctx.fillText(state === "over" ? "GAME OVER" : "GAME CLEAR!", W / 2, 190);
      ctx.font = "bold 28px Arial, sans-serif";
      ctx.fillText("TIME  " + mmss(gameTime), W / 2, 270);
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
  btn.textContent = "JUMP";
  btn.addEventListener("pointerdown", e => { e.preventDefault(); jump(); });
  s.root.appendChild(btn);

  reset();
  s.run(update, draw);
  return s.destroy;
}
