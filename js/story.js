// キャラクター(画像ができたら image に "img/kaguya.png" のように指定)
export const characters = {
  kaguya: { name: "かぐや", initial: "か", image: "" },
  sawara: { name: "早良親王", initial: "早", image: "" },
  taira: { name: "平将門", initial: "平", image: "" },
  sugawara: { name: "菅原道真", initial: "菅", image: "" },
  sutoku: { name: "崇徳天皇", initial: "崇", image: "" }
};

// 章のデータ。lines は [話す人, テキスト]。
//   game … 会話のあとに遊ぶゲームのid(js/games.js)
//   next … 次の章id、"home"、"end" のどれか
// ※セリフは仮です。自由に書き換えてください。
export const chapters = {
  // 1. プロローグ:月からの来訪者(かぐやだけが話す)
  prologue: {
    next: "home",
    lines: [
      ["kaguya", "竹の光に導かれて、ここまで来たのですね。"],
      ["sawara", "ここは向日の地。かつて長岡京があった場所だ。"],
      ["kaguya", "あなたに、この町の物語を見届けてほしいのです。"]
    ]
  },
  sawara1: { // 早良・長岡京・弾幕(チュートリアル)
    game: "danmaku_tutorial", next: "home",
    lines: [
      ["sawara", "まずは私の弾を避けてみなさい。操作はすぐに分かる。"],
      ["sawara", "当たらずに耐えれば、話を聞いてやろう。"]
    ]
  },
  taira: { // 平・向日神社・スライドパズル
    game: "slide_puzzle", next: "home",
    lines: [
      ["taira", "俺は平将門。ここで封印されている怨霊だ。"],
      ["taira", "数字を正しく並べて、封印を完成させてみろ。"]
    ]
  },
  sugawara: { // 菅原・千代桜天満宮・ワード探し
    game: "wordsearch", next: "home",
    lines: [
      ["sugawara", "私は菅原道真。学問の者として、試練を出そう。"],
      ["sugawara", "盤面に隠れた言葉を、すべて見つけてみなさい。"]
    ]
  },
  sutoku: { // 崇徳・竹の径・横スライダー
    game: "runner", next: "home",
    lines: [
      ["sutoku", "私は崇徳。この竹の径を、走り抜けられるかな。"],
      ["sutoku", "障害物を飛び越えて、逃げ切ってみせよ。"]
    ]
  },
  sawara2: { // 早良・長岡京・弾幕(ラスボス)
    game: "danmaku_boss", next: "ed",
    lines: [
      ["sawara", "ここまでよく来た。私の無念を、受け止められるか。"],
      ["kaguya", "大丈夫。あなたの歩いてきた道が、答えになります。"]
    ]
  },
 
  // 5. エンディング
  ed: {
    next: "end",
    lines: [
      ["sawara", "……そうか。みんなで穏やかに暮らす道もあるのだな。"],
      ["kaguya", "ありがとう。物語はここでおしまいです。"],
      ["kaguya", "これからは、好きなときにこの町を歩いてくださいね。"]
    ]
  }
};

// マップで進める章の順番(ピンから始まる章)
export const chapterOrder = ["sawara1", "taira", "sugawara", "sutoku", "sawara2"];
