import { start as wordsearch } from "./games/wordsearch.js";

// ミニゲームの入口。ゲームは start(container, onFinish) の形に揃える。
//   container … ゲームを表示する場所(div)
//   onFinish("clear" | "fail") … 終わったら呼ぶ
//   戻り値 … ゲームを止める関数(画面を離れるときに呼ばれる)
//
// 本物ができたゲーム: wordsearch。それ以外は「仮のゲーム」(クリア/失敗ボタンだけ)です。
// 本物ができたら、該当する id を差し替えていきます。

const titles = {
  danmaku_tutorial: "弾幕(チュートリアル)",
  slide_puzzle: "スライドパズル",
  wordsearch: "ワード探し",
  runner: "横スライダー",
  danmaku_boss: "弾幕(ラスボス)"
};

function placeholder(id, box, onFinish) {
  box.innerHTML = `
    <div class="placeholder">
      <h2>${titles[id]}</h2>
      <p>ここにゲームが入ります(仮)</p>
      <div class="actions">
        <button class="btn main" data-r="clear">クリアにする</button>
        <button class="btn" data-r="fail">失敗にする</button>
      </div>
    </div>`;
  box.onclick = e => {
    const r = e.target.dataset.r;
    if (r) onFinish(r);
  };
  return () => { box.innerHTML = ""; box.onclick = null; };
}

// 本物のゲームができたら、ここに登録する
const impl = {
  wordsearch
};

export function startGame(id, box, onFinish) {
  return (impl[id] || ((b, f) => placeholder(id, b, f)))(box, onFinish);
}
