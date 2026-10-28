import { start as wordsearch } from "./games/wordsearch.js";
import { start as danmakuTutorial } from "./games/danmaku_tutorial.js";
import { start as danmakuBoss } from "./games/danmaku_boss.js";
import { start as slidePuzzle } from "./games/slide_puzzle.js";
import { start as runner } from "./games/runner.js";

// ミニゲームの入口。ゲームは start(container, onFinish) の形に揃える。
//   container … ゲームを表示する場所(div)
//   onFinish("clear" | "fail") … 終わったら呼ぶ
//   戻り値 … ゲームを止める関数(画面を離れるときに呼ばれる)
//
// 5本とも本物が入っています。登録のないidは「仮のゲーム」(クリア/失敗ボタンだけ)になります。
// 本物ができたら、該当する id を差し替えていきます。

const titles = {
  danmaku_tutorial: "弾幕(チュートリアル)",
  slide_puzzle: "スライドパズル",
  wordsearch: "ワード探し",
  runner: "RUN ESCAPE",
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
  danmaku_tutorial: danmakuTutorial,  // 第一章: 早良親王(負けイベント)
  wordsearch,                         // 第二章: 平将門
  slide_puzzle: slidePuzzle,          // 第三章: 菅原道真
  runner,                             // 第四章: 崇徳上皇(RUN ESCAPE)
  danmaku_boss: danmakuBoss           // 最終章: 早良親王
};

export function startGame(id, box, onFinish) {
  const opts = (globalThis.__gameTestOpts || {})[id]; // テスト用(ふだんは空)
  return (impl[id] || ((b, f) => placeholder(id, b, f)))(box, onFinish, opts);
}
