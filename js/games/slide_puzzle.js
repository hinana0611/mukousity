// スライドパズル「記憶の絵鏡」(第三章・菅原道真)
// 元の main_1_1.cpp(4×4の15パズル)を、絵のパズルとして作り直したもの。
// 絵がまだないので、いまは桜・月・本・「学問」をプログラムで描いています。
// 本物の絵(正方形のPNG)ができたら、PICTURE_URL に "img/michizane.png" のように書くと差し替わります。
// start(box, onFinish, opts): 完成したら onFinish("clear")。opts.depth はテスト用。戻り値は後始末の関数。

const SIZE = 4;               // 4×4
const SCRAMBLE_DEPTH = 50;    // 混ぜる回数(多いほど難しい。元のC++は35→60)
const PICTURE_URL = "";       // 例: "img/michizane.png"

/* ----- 仮の絵を描く ----- */
function seeded(a) { // 毎回同じ乱数(絵が毎回同じになるように)
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPicture() {
  const N = 480;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d");
  const rnd = seeded(7);

  // 空
  const sky = g.createLinearGradient(0, 0, 0, N);
  sky.addColorStop(0, "#16264a"); sky.addColorStop(0.6, "#5a4b86"); sky.addColorStop(1, "#d98fa8");
  g.fillStyle = sky; g.fillRect(0, 0, N, N);
  // 星
  g.fillStyle = "rgba(255,255,255,.85)";
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(rnd() * N, rnd() * N * 0.5, 0.8 + rnd() * 1.4, 0, 7); g.fill(); }
  // 月
  const glow = g.createRadialGradient(370, 110, 20, 370, 110, 110);
  glow.addColorStop(0, "rgba(246,231,168,.55)"); glow.addColorStop(1, "rgba(246,231,168,0)");
  g.fillStyle = glow; g.fillRect(260, 0, 220, 230);
  g.fillStyle = "#f6e7a8"; g.beginPath(); g.arc(370, 110, 56, 0, 7); g.fill();
  // 遠くの山
  g.fillStyle = "#2a1d3a";
  g.beginPath(); g.moveTo(0, 400); g.quadraticCurveTo(90, 330, 180, 385); g.quadraticCurveTo(300, 320, 400, 380); g.quadraticCurveTo(450, 360, 480, 390); g.lineTo(480, 480); g.lineTo(0, 480); g.fill();
  // 机
  g.fillStyle = "#3b2a2a"; g.fillRect(0, 425, N, 55);
  // 本
  g.fillStyle = "#f3ead2";
  g.beginPath(); g.moveTo(130, 420); g.lineTo(240, 400); g.lineTo(240, 440); g.lineTo(130, 450); g.fill();
  g.beginPath(); g.moveTo(240, 400); g.lineTo(350, 420); g.lineTo(350, 450); g.lineTo(240, 440); g.fill();
  g.strokeStyle = "rgba(60,40,40,.55)"; g.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    g.beginPath(); g.moveTo(145, 421 + i * 7); g.lineTo(228, 407 + i * 7); g.stroke();
    g.beginPath(); g.moveTo(252, 407 + i * 7); g.lineTo(336, 421 + i * 7); g.stroke();
  }
  // 桜の枝
  const bez = (t, p) => {
    const u = 1 - t;
    return [u*u*u*p[0] + 3*u*u*t*p[2] + 3*u*t*t*p[4] + t*t*t*p[6], u*u*u*p[1] + 3*u*u*t*p[3] + 3*u*t*t*p[5] + t*t*t*p[7]];
  };
  const branch = [-10, 70, 120, 160, 230, 30, 350, 120];
  g.strokeStyle = "#4a2f2a"; g.lineCap = "round"; g.lineWidth = 14;
  g.beginPath(); g.moveTo(branch[0], branch[1]); g.bezierCurveTo(...branch.slice(2)); g.stroke();
  g.lineWidth = 7;
  g.beginPath(); g.moveTo(190, 98); g.quadraticCurveTo(260, 200, 310, 250); g.stroke();
  g.beginPath(); g.moveTo(60, 110); g.quadraticCurveTo(70, 200, 40, 270); g.stroke();

  const flower = (x, y, r) => {
    g.fillStyle = "#ffc4d6";
    for (let k = 0; k < 5; k++) {
      const a = (Math.PI * 2 / 5) * k;
      g.beginPath(); g.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.55, 0, 7); g.fill();
    }
    g.fillStyle = "#e8789a"; g.beginPath(); g.arc(x, y, r * 0.3, 0, 7); g.fill();
  };
  for (let t = 0; t <= 1; t += 0.045) { const [x, y] = bez(t, branch); flower(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 40, 11 + rnd() * 8); }
  for (let i = 0; i < 9; i++) flower(200 + i * 14 + rnd() * 10, 110 + i * 16 + rnd() * 14, 10 + rnd() * 6);
  for (let i = 0; i < 8; i++) flower(60 - i * 3 + rnd() * 16, 115 + i * 20 + rnd() * 10, 9 + rnd() * 6);
  // 舞う花びら
  g.fillStyle = "rgba(255,196,214,.9)";
  for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(rnd() * N, 150 + rnd() * 270, 5, 3, rnd() * 3, 0, 7); g.fill(); }
  // 文字
  g.textAlign = "center"; g.textBaseline = "middle";
  g.font = 'bold 62px "Zen Maru Gothic", "Yu Mincho", serif';
  g.lineWidth = 6; g.strokeStyle = "rgba(20,10,30,.8)"; g.fillStyle = "#f7d774";
  g.strokeText("学", 432, 255); g.fillText("学", 432, 255);
  g.strokeText("問", 432, 325); g.fillText("問", 432, 325);
  g.font = 'bold 22px "Zen Maru Gothic", sans-serif'; g.textAlign = "left"; g.lineWidth = 4;
  g.strokeText("菅原道真", 22, 452); g.fillStyle = "#f3ead2"; g.fillText("菅原道真", 22, 452);
  // 枠
  g.strokeStyle = "#f7d774"; g.lineWidth = 6; g.strokeRect(3, 3, N - 6, N - 6);
  return c.toDataURL("image/png");
}

/* ----- ゲーム本体 ----- */
export function start(box, onFinish, opts = {}) {
  const url = PICTURE_URL || drawPicture();
  const CELLS = SIZE * SIZE;
  let tiles = [], initial = [], empty = CELLS - 1, moves = 0, solved = false, timer = null;

  box.innerHTML = `
    <div class="sp">
      <h2>記憶の絵鏡</h2>
      <p class="sub">バラバラになった絵を、正しい位置へスライドして完成させよう</p>
      <div class="sp-board" role="group" aria-label="スライドパズル"></div>
      <p class="sp-info">移動回数: <b class="sp-moves">0</b></p>
      <p class="sp-msg" aria-live="polite"></p>
      <div class="sp-btns">
        <button type="button" class="btn sp-reset">最初の配置に戻す</button>
        <button type="button" class="btn sp-shuffle">混ぜ直す</button>
      </div>
    </div>`;
  const q = sel => box.querySelector(sel);
  const board = q(".sp-board");

  const isSolved = () => { for (let i = 0; i < CELLS - 1; i++) if (tiles[i] !== i + 1) return false; return tiles[CELLS - 1] === 0; };

  function scramble() {
    tiles = Array.from({ length: CELLS }, (_, i) => (i + 1) % CELLS);
    empty = CELLS - 1; moves = 0; solved = false;
    let previous = -1;
    for (let i = 0; i < (opts.depth ?? SCRAMBLE_DEPTH); i++) { // 空きマスを動かすだけなので、必ず解ける
      const row = Math.floor(empty / SIZE), col = empty % SIZE, choices = [];
      if (row > 0 && empty - SIZE !== previous) choices.push(empty - SIZE);
      if (row < SIZE - 1 && empty + SIZE !== previous) choices.push(empty + SIZE);
      if (col > 0 && empty - 1 !== previous) choices.push(empty - 1);
      if (col < SIZE - 1 && empty + 1 !== previous) choices.push(empty + 1);
      const target = choices[Math.floor(Math.random() * choices.length)], old = empty;
      [tiles[empty], tiles[target]] = [tiles[target], tiles[empty]];
      empty = target; previous = old;
    }
    if (isSolved()) { // 最初から完成していたら、1手ずらす
      const target = empty % SIZE > 0 ? empty - 1 : empty + 1;
      [tiles[empty], tiles[target]] = [tiles[target], tiles[empty]];
      empty = target;
    }
    initial = [...tiles];
    q(".sp-msg").textContent = "";
    render();
  }

  function reset() { // 混ぜた直後の並びに戻す
    clearTimeout(timer);
    tiles = [...initial]; empty = tiles.indexOf(0); moves = 0; solved = false;
    q(".sp-msg").textContent = "";
    render();
  }

  function render() {
    board.classList.toggle("solved", solved);
    board.innerHTML = "";
    tiles.forEach((n, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.i = i;
      const piece = n !== 0 ? n - 1 : CELLS - 1;     // 完成したら、空きマスにも最後のかけらを出す
      if (n === 0 && !solved) {
        b.className = "sp-tile empty";
        b.tabIndex = -1;
      } else {
        const r = Math.floor(piece / SIZE), c = piece % SIZE;
        b.className = "sp-tile";
        b.style.backgroundImage = `url("${url}")`;
        b.style.backgroundSize = `${SIZE * 100}% ${SIZE * 100}%`;
        b.style.backgroundPosition = `${(c * 100) / (SIZE - 1)}% ${(r * 100) / (SIZE - 1)}%`;
        b.setAttribute("aria-label", `かけら ${piece + 1}`);
        const badge = document.createElement("span");
        badge.className = "sp-n";
        badge.textContent = piece + 1;
        b.appendChild(badge);
      }
      board.appendChild(b);
    });
    q(".sp-moves").textContent = moves;
  }

  function move(i) {
    if (solved) return;
    const dr = Math.abs(Math.floor(i / SIZE) - Math.floor(empty / SIZE)), dc = Math.abs((i % SIZE) - (empty % SIZE));
    if (dr + dc !== 1) return; // 空きマスの隣だけ動かせる
    [tiles[i], tiles[empty]] = [tiles[empty], tiles[i]];
    empty = i; moves++;
    if (isSolved()) {
      solved = true;
      q(".sp-msg").textContent = "記憶の絵鏡が完成した!";
      timer = setTimeout(() => onFinish("clear"), 1600);
    }
    render();
  }

  board.onclick = e => {
    const t = e.target.closest(".sp-tile");
    if (t) move(Number(t.dataset.i));
  };
  q(".sp-reset").onclick = reset;
  q(".sp-shuffle").onclick = () => { clearTimeout(timer); scramble(); };

  scramble();
  return () => { clearTimeout(timer); box.innerHTML = ""; };
}
