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
      const STEP = 1000 / 60;
      let last = performance.now(), acc = 0;
      const tick = now => {
        if (stopped) return;
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
