// 弾幕ゲーム「チュートリアル戦」(第一章・早良親王の負けイベント)
// 敵のHPを半分まで減らすと、避けられない特殊攻撃で必ず負ける。負けても物語は進む。
// start(box, onFinish): 終わったら onFinish("fail") を呼ぶ。戻り値は後始末の関数。
import { createStage, makeNightSky, drawOnryo, drawOrb, drawPetal, drawHeart, drawBar } from "./kit.js";

export function start(box, onFinish) {
  const s = createStage(box, { title: "チュートリアル戦", left: "HP: 3", right: "SCORE: 0" });
  const { canvas, ctx, keys } = s;

  const player = { x: 400, y: 500, size: 8, speed: 3 };
  const enemy = { x: 400, y: 100, size: 40, hp: 100, maxHp: 100 };
  let hp = 3, score = 0, frame = 0, danmakuAngle = 0;
  let playerBullets = [], enemyBullets = [];
  let defeatEvent = false, defeatTimer = 0, defeatFinished = false, gameOverFlag = false;

  const info = () => s.setInfo("HP: " + hp, "SCORE: " + score);
  const clampPlayer = () => {
    player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
  };
  s.onDrag = (dx, dy) => { if (!gameOverFlag) { player.x += dx; player.y += dy; clampPlayer(); } };

  function updatePlayer() {
    if (keys.left) player.x -= player.speed;
    if (keys.right) player.x += player.speed;
    if (keys.up) player.y -= player.speed;
    if (keys.down) player.y += player.speed;
    clampPlayer();
  }

  function shootPlayer() {
    if (defeatEvent) return;
    playerBullets.push({ x: player.x, y: player.y - 15, speed: 8, size: 5 });
  }

  function updatePlayerBullets() {
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.y -= b.speed;
      if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < b.size + enemy.size) {
        enemy.hp -= 1;
        playerBullets.splice(i, 1);
        score += 10;
        info();
        if (enemy.hp <= 50 && !defeatEvent) startDefeatEvent(); // HP50以下で負けイベント
        continue;
      }
      if (b.y < -20) playerBullets.splice(i, 1);
    }
  }

  function shootEnemy() {
    if (defeatEvent) return;
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + danmakuAngle;
      enemyBullets.push({ x: enemy.x, y: enemy.y, dx: Math.cos(angle) * 1.5, dy: Math.sin(angle) * 1.5, size: 6, special: false });
    }
  }

  function updateEnemyBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (b.special) b.y += b.dy;            // 特殊弾は上から下へ
      else { b.x += b.dx; b.y += b.dy; }

      if (Math.hypot(b.x - player.x, b.y - player.y) < b.size + player.size) {
        enemyBullets.splice(i, 1);
        if (b.special) { specialAttackHit(); return; }
        if (!defeatEvent) {
          hp--;
          info();
          if (hp <= 0) gameOver();
        }
        continue;
      }
      if (b.x < -100 || b.x > canvas.width + 100 || b.y < -100 || b.y > canvas.height + 100) enemyBullets.splice(i, 1);
    }
  }

  function startDefeatEvent() {
    defeatEvent = true;
    defeatTimer = 0;
    defeatFinished = false;
    playerBullets = [];
    enemyBullets = [];
    s.setMessage("WARNING...");
  }

  // 画面の端から端まで、隙間なく並んだ弾(避けられない)
  function shootUnavoidableDanmaku() {
    for (let x = 0; x <= canvas.width; x += 30) {
      enemyBullets.push({ x, y: enemy.y + enemy.size + 10, dx: 0, dy: 1.5, size: 12, special: true });
    }
  }

  function specialAttackHit() {
    if (defeatFinished) return;
    defeatFinished = true;
    hp = 0;
    info();
    gameOver();
  }

  function updateDefeatEvent() {
    if (!defeatEvent) return;
    defeatTimer++;
    if (defeatTimer < 60) s.setMessage("WARNING...");
    else if (defeatTimer < 120) s.setMessage("特殊攻撃をチャージ中...");
    else if (defeatTimer === 120) { s.setMessage("SPECIAL ATTACK"); shootUnavoidableDanmaku(); }
    else if (defeatTimer % 20 === 0) shootUnavoidableDanmaku(); // 20フレームごとに横一列を追加
  }

  function gameOver() {
    if (gameOverFlag) return;
    gameOverFlag = true;
    defeatEvent = false;
    s.setMessage("GAME OVER");
    s.later(() => onFinish("fail"), 1000);
  }

  function update() {
    if (gameOverFlag) return;
    frame++;
    updatePlayer();
    updatePlayerBullets();
    updateEnemyBullets();
    updateDefeatEvent();
    if (gameOverFlag) return;
    if (frame % 60 === 0 && !defeatEvent) { shootEnemy(); danmakuAngle += Math.PI / 18; }
    if (frame % 10 === 0 && !defeatEvent) shootPlayer();
  }

  // 見た目(当たり判定は上の数字のまま。絵だけ、かわいく描く)
  const sky = makeNightSky(canvas.width, canvas.height);
  function draw() {
    sky(ctx);
    // 敵: 早良親王の怨霊(長い黒髪・赤い目)。特殊攻撃の前は、むらさきのオーラで、もっと怒る
    drawOnryo(ctx, enemy.x, enemy.y, enemy.size, defeatEvent
      ? { body: "#f1e6ff", shade: "#5a3a8a", aura: "rgba(140, 40, 220, .65)", frame, rage: true }
      : { body: "#f6eef4", shade: "#7a5a7a", aura: "rgba(180, 20, 60, .5)", frame });
    drawBar(ctx, enemy.x - 55, enemy.y - enemy.size - 26, 110, 12, enemy.hp / enemy.maxHp);
    // 自分の弾(桜の花びら)と、敵の弾(光る玉)
    playerBullets.forEach(b => drawPetal(ctx, b.x, b.y, b.size));
    enemyBullets.forEach(b => drawOrb(ctx, b.x, b.y, b.size, b.special ? "#9b3cff" : "#ff3f6e"));
    // 自分(ハート)
    drawHeart(ctx, player.x, player.y, player.size * 1.5);
  }

  info();
  s.run(update, draw);
  return s.destroy;
}
