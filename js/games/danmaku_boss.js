// 弾幕ゲーム「ラスボス戦」(最終章・早良親王)
// 3つの形態(HPの70%・40%で切り替わる)と、約10秒ごとの横一列攻撃。ボスを倒せばクリア、プレイヤーHPが0で失敗。
// start(box, onFinish, opts): onFinish("clear" | "fail")。opts.bossHp はテスト用。戻り値は後始末の関数。
import { createStage } from "./kit.js";

export function start(box, onFinish, opts = {}) {
  const s = createStage(box, { title: "ラスボス戦", left: "HP: 10", right: "ボスHP: 500" });
  const { canvas, ctx, keys } = s;

  const player = { x: 400, y: 500, size: 8, speed: 3 };
  let playerHp = 10;
  const bossMax = opts.bossHp ?? 500;
  const enemy = { x: 400, y: 120, size: 80, hp: bossMax, maxHp: bossMax };

  let playerBullets = [], enemyBullets = [];
  let frame = 0, danmakuAngle = 0;
  let invincibleTimer = 0, blinkTimer = 0;
  let currentPhase = 1, phaseMessage = "", phaseMessageTimer = 0;
  let hWarning = false, hWarningTimer = 0, hActive = false, hFireTimer = 0, hTargetY = 0;
  let ended = false;

  const info = () => s.setInfo("HP: " + playerHp, "ボスHP: " + Math.max(0, enemy.hp));
  const clampPlayer = () => {
    player.x = Math.max(player.size, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(player.size, Math.min(canvas.height - player.size, player.y));
  };
  s.onDrag = (dx, dy) => { if (!ended) { player.x += dx; player.y += dy; clampPlayer(); } };

  /* ----- フェーズ ----- */
  function getBossPhase() {
    const p = enemy.hp / enemy.maxHp;
    return p > 0.7 ? 1 : p > 0.4 ? 2 : 3;
  }
  function checkPhaseChange() {
    const n = getBossPhase();
    if (n !== currentPhase) {
      currentPhase = n;
      phaseMessage = "PHASE " + n;
      phaseMessageTimer = 120;
      enemyBullets = [];
      danmakuAngle = 0;
    }
  }

  /* ----- ボスの動き ----- */
  function updateBoss() {
    const phase = getBossPhase();
    if (phase === 1) { enemy.x = 400; enemy.y = 120; return; }                 // 第1形態: 動かない
    if (phase === 2) {                                                          // 第2形態: ゆっくり横移動
      enemy.x = Math.max(80, Math.min(canvas.width - 80, 400 + Math.sin(frame * 0.004) * 280));
      enemy.y = 120;
      return;
    }
    const t = frame * 0.008 * 0.35;                                             // 第3形態: ゆっくりW字移動
    enemy.x = Math.max(80, Math.min(canvas.width - 80, 400 + Math.sin(t) * 280));
    enemy.y = Math.max(80, Math.min(230, 130 + Math.abs(Math.sin(t * 2)) * 80));
  }

  /* ----- 弾幕 ----- */
  function getDanmakuSetting() {
    const phase = getBossPhase();
    if (phase === 1) return { count: 24, speed: 1.5, size: 6, interval: 60, angle: Math.PI / 18, type: 1 };
    if (phase === 2) return { count: 32, speed: 1.3, size: 6, interval: 150, angle: Math.PI / 12, type: 2 };
    return { count: 40, speed: 2.0, size: 7, interval: 180, angle: Math.PI / 9, type: 3 };
  }
  function shootDanmaku() {
    const st = getDanmakuSetting();
    for (let i = 0; i < st.count; i++) {
      const angle = (Math.PI * 2 / st.count) * i + danmakuAngle;
      enemyBullets.push({ x: enemy.x, y: enemy.y, dx: Math.cos(angle) * st.speed, dy: Math.sin(angle) * st.speed, size: st.size, type: st.type });
    }
    danmakuAngle += st.angle;
  }
  function shootPlayer() {
    playerBullets.push({ x: player.x, y: player.y, dx: 0, dy: -7, size: 4 });
  }

  function updatePlayerBullets() {
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const b = playerBullets[i];
      b.x += b.dx; b.y += b.dy;
      if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) { playerBullets.splice(i, 1); continue; }
      if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < enemy.size / 2) {
        enemy.hp--;
        playerBullets.splice(i, 1);
        info();
      }
    }
  }

  function checkBulletCollision(b) {
    if (invincibleTimer > 0) return false;
    if (Math.hypot(b.x - player.x, b.y - player.y) < b.size + player.size) {
      playerHp--;
      invincibleTimer = 120; // 約2秒無敵
      blinkTimer = 0;
      info();
      if (playerHp <= 0) gameOver();
      return true;
    }
    return false;
  }

  function updateNormalBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (b.horizontal) continue;
      b.x += b.dx; b.y += b.dy;
      checkBulletCollision(b);
      if (b.x < -30 || b.x > canvas.width + 30 || b.y < -30 || b.y > canvas.height + 30) enemyBullets.splice(i, 1);
    }
  }

  function updateHorizontalBullets() {
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const b = enemyBullets[i];
      if (!b.horizontal) continue;
      if (!b.reachedRight) {
        b.x += b.dx;
        checkBulletCollision(b);
        if (b.x >= canvas.width) { b.reachedRight = true; b.waitTimer = 0; }
      } else if (++b.waitTimer >= 60) {
        enemyBullets.splice(i, 1);
      }
    }
  }

  /* ----- 横攻撃(警告 → 発射) ----- */
  function updateHorizontalAttack() {
    if (frame > 0 && frame % 600 === 0 && !hActive && !hWarning) { // 約10秒ごと
      hWarning = true; hWarningTimer = 0; hTargetY = player.y;     // 警告開始時のプレイヤーYを狙う
    }
    if (hWarning) {
      if (++hWarningTimer >= 60) { hWarning = false; hActive = true; hFireTimer = 0; }
      return;
    }
    if (hActive) {
      hFireTimer++;
      if (hFireTimer % 5 === 0) {
        enemyBullets.push({ x: -15, y: hTargetY, dx: 5, dy: 0, size: 9, special: true, horizontal: true, reachedRight: false, waitTimer: 0 });
      }
      if (hFireTimer >= 120) hActive = false;
    }
  }

  /* ----- 終わり ----- */
  function end(result, message, delay) {
    if (ended) return;
    ended = true;
    s.setMessage(message);
    s.later(() => onFinish(result), delay);
  }
  const gameOver = () => end("fail", "GAME OVER", 1000);

  function update() {
    if (ended) return;
    frame++;
    if (keys.up) player.y -= player.speed;
    if (keys.down) player.y += player.speed;
    if (keys.left) player.x -= player.speed;
    if (keys.right) player.x += player.speed;
    clampPlayer();

    updateBoss();
    updatePlayerBullets();
    updateNormalBullets();
    updateHorizontalBullets();
    if (invincibleTimer > 0) { invincibleTimer--; blinkTimer++; }
    checkPhaseChange();
    if (frame % 10 === 0) shootPlayer();
    if (frame % getDanmakuSetting().interval === 0 && enemy.hp > 0) shootDanmaku();
    updateHorizontalAttack();
    if (phaseMessageTimer > 0) phaseMessageTimer--;
    if (enemy.hp <= 0) end("clear", "ラスボス撃破!", 1400);
  }

  /* ----- 描画 ----- */
  const circle = (x, y, r, color) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); };

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ボス
    const phase = getBossPhase();
    circle(enemy.x, enemy.y, enemy.size / 2, phase === 1 ? "#a020f0" : phase === 2 ? "#ff8800" : "#ff2020");
    ctx.beginPath(); ctx.arc(enemy.x, enemy.y, enemy.size / 2 + 8, 0, Math.PI * 2);
    ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.stroke();
    circle(enemy.x, enemy.y, enemy.size / 5, "white");

    // ボスHPバー
    const bw = 500, bx = (canvas.width - bw) / 2;
    ctx.fillStyle = "#333"; ctx.fillRect(bx, 20, bw, 15);
    ctx.fillStyle = "#ff3030"; ctx.fillRect(bx, 20, bw * Math.max(0, enemy.hp / enemy.maxHp), 15);
    ctx.strokeStyle = "white"; ctx.lineWidth = 1; ctx.strokeRect(bx, 20, bw, 15);

    playerBullets.forEach(b => circle(b.x, b.y, b.size, "cyan"));
    enemyBullets.forEach(b => circle(b.x, b.y, b.size,
      b.horizontal ? "#ff3333" : b.type === 1 ? "#ff66cc" : b.type === 2 ? "#ffff33" : "#ff2222"));

    // プレイヤー(無敵中は点滅)
    if (!(invincibleTimer > 0 && Math.floor(blinkTimer / 6) % 2 === 0)) {
      circle(player.x, player.y, player.size, "cyan");
      if (invincibleTimer > 0) {
        ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 5, 0, Math.PI * 2);
        ctx.strokeStyle = "white"; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // 横攻撃の警告
    if (hWarning) {
      const top = hTargetY - 20;
      ctx.fillStyle = "rgba(255, 0, 0, 0.20)"; ctx.fillRect(0, top, canvas.width, 40);
      ctx.fillStyle = "red"; ctx.fillRect(0, top, canvas.width, 2); ctx.fillRect(0, top + 38, canvas.width, 2);
      ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("!!!", canvas.width / 2, hTargetY);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    }

    // フェーズ表示
    if (phaseMessageTimer > 0) {
      ctx.font = "bold 50px sans-serif"; ctx.fillStyle = "white"; ctx.textAlign = "center";
      ctx.fillText(phaseMessage, canvas.width / 2, canvas.height / 2);
      ctx.textAlign = "left";
    }
  }

  info();
  s.run(update, draw);
  return s.destroy;
}
