// 弾幕ゲーム「ラスボス戦」(最終章・早良親王)
// 3つの形態(HPの70%・40%で切り替わる)と、約10秒ごとの横一列攻撃。ボスを倒せばクリア、プレイヤーHPが0で失敗。
// ・自分のHPは5。やられそうになったら(HPが0になる攻撃を受けたら)、三大怨霊(平将門・菅原道真・崇徳上皇)が
//   1人ずつ身代わりになって守ってくれる(3回まで)
// ・第2形態から「必殺技」が使える(ボタン か スペースキー)。弾を全部消して、ボスに大ダメージ。使うと7秒チャージ
// start(box, onFinish, opts): onFinish("clear" | "fail")。opts.bossHp / opts.playerHp はテスト用。戻り値は後始末の関数。
import { createStage, makeNightSky, drawOnryo, drawOrb, drawPetal, drawHeart, drawBar, drawBigText } from "./kit.js";

export function start(box, onFinish, opts = {}) {
  const s = createStage(box, { title: "ラスボス戦", left: "HP: 5", right: "ボスHP: 500" });
  const { canvas, ctx, keys } = s;

  const player = { x: 400, y: 500, size: 8, speed: 3 };
  let playerHp = opts.playerHp ?? 5;

  /* ----- 身代わり(三大怨霊) ----- */
  // 救ってきた3人が、やられそうなときに1回ずつ守ってくれる
  const guards = [
    { key: "taira", name: "平将門", color: "#7fd18a" },
    { key: "sugawara", name: "菅原道真", color: "#c27cf0" },
    { key: "sutoku", name: "崇徳上皇", color: "#7fb4ff" }
  ].map(g => {
    const img = new Image();
    img.src = `img/${g.key}_normal.webp`;
    return { ...g, img, used: false };
  });
  let guardShow = null, guardTimer = 0; // いま身代わりになった子(画面のまん中に出す)

  /* ----- 必殺技 ----- */
  const SPECIAL_CHARGE = 420;         // 次に使えるまで(約7秒)
  const SPECIAL_DAMAGE = 0.12;        // ボスの最大HPの12%
  let specialCharge = SPECIAL_CHARGE; // はじめて第2形態になったときは、すぐ使える
  let specialTimer = 0;               // 必殺技の演出の残り時間
  let specialPetals = [];
  const specialBtn = document.createElement("button");
  specialBtn.type = "button";
  specialBtn.className = "btn main dm-jump dm-special";
  specialBtn.hidden = true;
  s.root.appendChild(specialBtn);
  specialBtn.addEventListener("pointerdown", e => { e.preventDefault(); useSpecial(); });
  specialBtn.addEventListener("contextmenu", e => e.preventDefault());
  s.onKeyDown = e => { if (e.key === " " || e.key === "x" || e.key === "X") useSpecial(); };
  let btnText = "", btnReady = null;
  const bossMax = opts.bossHp ?? 500;
  const enemy = { x: 400, y: 120, size: 80, hp: bossMax, maxHp: bossMax };

  let playerBullets = [], enemyBullets = [];
  let frame = 0, danmakuAngle = 0;
  let invincibleTimer = 0, blinkTimer = 0;
  let currentPhase = 1, phaseMessage = "", phaseMessageTimer = 0;
  let hWarning = false, hWarningTimer = 0, hActive = false, hFireTimer = 0, hTargetY = 0;
  let ended = false;

  // 身代わりの人数は、ないしょ(身代わりになったときに、はじめて分かる)
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
      if (n === 2) { s.setMessage("必殺技が使えるようになった!"); s.later(() => { if (!ended) s.setMessage(""); }, 2500); }
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
      const guard = playerHp <= 1 ? guards.find(g => !g.used) : null;
      if (guard) {
        // やられそう! → 三大怨霊が身代わりになってくれる(HPは減らない)
        guard.used = true;
        guardShow = guard; guardTimer = 120;
        invincibleTimer = 180; // 約3秒無敵
        s.setMessage(`${guard.name}が身代わりになってくれた!`);
        s.later(() => { if (!ended) s.setMessage(""); }, 2500);
      } else {
        playerHp--;
        invincibleTimer = 150; // 約2.5秒無敵(当たったあと、立て直す時間)
      }
      blinkTimer = 0;
      info();
      if (playerHp <= 0) gameOver();
      return true;
    }
    return false;
  }

  /* ----- 必殺技「桜吹雪」 ----- */
  const specialReady = () => getBossPhase() >= 2 && specialCharge >= SPECIAL_CHARGE && !ended && enemy.hp > 0;
  function useSpecial() {
    if (!specialReady()) return;
    specialCharge = 0;
    specialTimer = 90;
    enemyBullets = [];                 // 怨念の弾を全部消す
    hWarning = false; hActive = false; // 横攻撃も止める
    invincibleTimer = Math.max(invincibleTimer, 60);
    enemy.hp = Math.max(0, enemy.hp - Math.ceil(enemy.maxHp * SPECIAL_DAMAGE));
    // 画面いっぱいに花びらを散らす(見た目だけ)
    specialPetals = Array.from({ length: 70 }, () => ({
      x: player.x, y: player.y,
      dx: (Math.random() - 0.5) * 18, dy: (Math.random() - 0.7) * 16, size: 5 + Math.random() * 6
    }));
    info();
  }
  // ボタンの文字(チャージの様子)。変わったときだけ書きかえる
  function updateSpecialButton() {
    const show = getBossPhase() >= 2 && !ended;
    if (specialBtn.hidden === show) specialBtn.hidden = !show;
    if (!show) return;
    const ready = specialReady();
    const text = ready ? "🌸 必殺技!" : `チャージ中… ${Math.floor(specialCharge / SPECIAL_CHARGE * 100)}%`;
    if (text !== btnText) { btnText = text; specialBtn.textContent = text; }
    if (ready !== btnReady) { btnReady = ready; specialBtn.classList.toggle("ready", ready); specialBtn.disabled = !ready; }
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
    specialBtn.hidden = true;
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
    if (getBossPhase() >= 2 && specialCharge < SPECIAL_CHARGE) specialCharge++;
    if (specialTimer > 0) specialTimer--;
    if (guardTimer > 0) guardTimer--;
    specialPetals.forEach(p => { p.x += p.dx; p.y += p.dy; p.dy += 0.25; });
    if (specialTimer === 0) specialPetals = [];
    checkPhaseChange();
    updateSpecialButton();
    if (frame % 10 === 0) shootPlayer();
    if (frame % getDanmakuSetting().interval === 0 && enemy.hp > 0) shootDanmaku();
    updateHorizontalAttack();
    if (phaseMessageTimer > 0) phaseMessageTimer--;
    if (enemy.hp <= 0) end("clear", "ラスボス撃破!", 1400);
  }

  /* ----- 描画 ----- */

  // 見た目(当たり判定は上の数字のまま。絵だけ、かわいく描く)
  const sky = makeNightSky(canvas.width, canvas.height, { tint: "#3a1850" });
  // 形態ごとの色: 1 むらさきのオーラ → 2 だいだい(炎) → 3 まっ赤(本気)
  const PHASE_LOOK = {
    1: { body: "#f1e9ff", shade: "#5c4486", aura: "rgba(130, 50, 210, .55)" },
    2: { body: "#fff0e6", shade: "#8a4a3a", aura: "rgba(230, 110, 30, .55)", rage: true },
    3: { body: "#ffe9ec", shade: "#7a1f35", aura: "rgba(220, 10, 40, .7)", rage: true }
  };
  function draw() {
    sky(ctx);

    // ボス: 早良親王の怨霊(長い黒髪・赤く光る目・人魂)
    const phase = getBossPhase();
    drawOnryo(ctx, enemy.x, enemy.y, enemy.size / 2 + 6, { ...PHASE_LOOK[phase], frame });

    // ボスHPバー
    const bw = 500, bx = (canvas.width - bw) / 2;
    drawBar(ctx, bx, 18, bw, 16, enemy.hp / enemy.maxHp, ["#ff6f91", "#ffb36b"]);

    playerBullets.forEach(b => drawPetal(ctx, b.x, b.y, b.size));
    enemyBullets.forEach(b => drawOrb(ctx, b.x, b.y, b.size,
      b.horizontal ? "#ff2a4a" : b.type === 1 ? "#c04cff" : b.type === 2 ? "#ffb02e" : "#ff3f6e"));

    // 自分(ハート。無敵中は点滅して、まわりに輪)
    if (!(invincibleTimer > 0 && Math.floor(blinkTimer / 6) % 2 === 0)) {
      drawHeart(ctx, player.x, player.y, player.size * 1.5);
      if (invincibleTimer > 0) {
        ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 9, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // 横攻撃の警告
    if (hWarning) {
      const top = hTargetY - 20;
      ctx.fillStyle = "rgba(255, 90, 122, 0.22)"; ctx.fillRect(0, top, canvas.width, 40);
      ctx.fillStyle = "#ff5a7a"; ctx.fillRect(0, top, canvas.width, 2); ctx.fillRect(0, top + 38, canvas.width, 2);
      drawBigText(ctx, "!!!", canvas.width / 2, hTargetY, 28, "#ffffff", "#ff5a7a");
    }

    // 必殺技の演出: 桜色の光と、飛び散る花びら
    if (specialTimer > 0) {
      ctx.fillStyle = `rgba(255, 190, 214, ${specialTimer / 90 * 0.45})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      specialPetals.forEach(p => drawPetal(ctx, p.x, p.y, p.size));
      if (specialTimer > 30) drawBigText(ctx, "必殺・桜吹雪!", canvas.width / 2, canvas.height / 2 - 60, 46, "#ffffff", "#ff6f91");
    }

    // 身代わりになった子を、そのときだけ、まん中に大きく出す(ふだんは見せない)
    if (guardTimer > 0 && guardShow) {
      const a = Math.min(1, guardTimer / 30);
      drawGuard(guardShow, canvas.width / 2, canvas.height / 2 - 20, 80, a);
      ctx.globalAlpha = a;
      drawBigText(ctx, `${guardShow.name}が身代わりに!`, canvas.width / 2, canvas.height / 2 + 90, 34, "#ffffff", guardShow.color);
      ctx.globalAlpha = 1;
    }

    // フェーズ表示
    if (phaseMessageTimer > 0) drawBigText(ctx, phaseMessage, canvas.width / 2, canvas.height / 2, 50);
  }

  // 身代わりの子の顔を、まるい枠に入れて描く(立ち絵の顔のあたりを切り抜く)
  function drawGuard(g, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#2a2060"; ctx.fill();
    if (g.img.complete && g.img.naturalWidth) {
      ctx.save(); ctx.clip();
      ctx.drawImage(g.img, 392 - 120, 30, 240, 240, x - r, y - r, r * 2, r * 2); // 顔は横53%(392px)のあたり
      ctx.restore();
    }
    ctx.lineWidth = 4; ctx.strokeStyle = g.color; ctx.stroke();
    ctx.restore();
  }

  info();
  s.run(update, draw);
  return s.destroy;
}
