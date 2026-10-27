// 弾幕ゲーム「チュートリアル戦」(第一章・早良親王の負けイベント)
// 敵のHPを半分まで減らすと、避けられない特殊攻撃で必ず負ける。負けても物語は進む。
// start(box, onFinish): 終わったら onFinish("fail") を呼ぶ。戻り値は後始末の関数。
import { createStage } from "./kit.js";

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

  const circle = (x, y, r, color) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };

  function draw() {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // 敵
    circle(enemy.x, enemy.y, enemy.size, defeatEvent ? "purple" : "red");
    circle(enemy.x - 13, enemy.y - 8, 6, "white");
    circle(enemy.x + 13, enemy.y - 8, 6, "white");
    ctx.fillStyle = "gray"; ctx.fillRect(enemy.x - 50, enemy.y - 60, 100, 10);
    ctx.fillStyle = "lime"; ctx.fillRect(enemy.x - 50, enemy.y - 60, 100 * (enemy.hp / enemy.maxHp), 10);
    // プレイヤー
    circle(player.x, player.y, player.size, "cyan");
    circle(player.x, player.y, 3, "white");
    // 弾
    playerBullets.forEach(b => circle(b.x, b.y, b.size, "yellow"));
    enemyBullets.forEach(b => circle(b.x, b.y, b.size, b.special ? "#ff2222" : "pink"));
  }

  info();
  s.run(update, draw);
  return s.destroy;
}
