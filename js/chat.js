// AI会話の窓口。main.js からはこの関数だけを呼ぶ。
// mode: "story"(進捗に沿った会話) / "free"(クリア後の自由会話)
//
// いまは固定の返事を返すダミーです。
// 本物のAIにするときは、この関数の中身だけを差し替えてください。
// 注意: APIキーをこのファイル(ブラウザ側)に書かないこと。
//       中継サーバー(Cloudflare Workers、Vercel など)経由で呼び出します。

const dummy = {
  story: [
    "いまは物語の途中ですね。マップのピンを押して先へ進みましょう。",
    "ゆっくりで大丈夫です。気になることがあれば聞いてください。"
  ],
  free: [
    "向日市のことなら何でも聞いてください。",
    "気になる場所があれば、マップから訪ねてみましょう。"
  ]
};
let n = 0;

export async function sendMessage(text, mode = "story") {
  await new Promise(r => setTimeout(r, 400)); // 返事を待っている感じを出す
  const list = dummy[mode] || dummy.story;
  return list[n++ % list.length];
}
