// キャラクター(画像ができたら image に "img/kaguya.png" のように指定)
export const characters = {
  kaguya: { name: "かぐや", initial: "か", image: "" },
  sawara: { name: "早良親王", initial: "早", image: "" },
  sutoku: { name: "崇徳天皇", initial: "崇", image: "" }
};

// 章のデータ。lines は [話す人, テキスト]。next は次の章id、"home"、"end" のどれか。
// ※セリフは仮です。自由に書き換えてください。
export const chapters = {
  prologue: {
    next: "tutorial",
    lines: [
      ["kaguya", "竹の光に導かれて、ここまで来たのですね。"],
      ["sawara", "ここは向日の地。かつて長岡京があった場所だ。"],
      ["kaguya", "あなたに、この町の物語を見届けてほしいのです。"]
    ]
  },
  tutorial: {
    next: "home",
    lines: [
      ["sawara", "まずは使い方を教えよう。左上のボタンからメニューが開く。"],
      ["sawara", "マップでは、行ける場所にピンが光っている。押してみるといい。"],
      ["sawara", "「会話」では、私やかぐやと話せる。困ったら聞きに来なさい。"]
    ]
  },
  nagaoka: {
    next: "home",
    lines: [
      ["kaguya", "ここが長岡宮の跡です。大きな宮殿が建っていました。"],
      ["sawara", "都が移され、この地は新しい時代の舞台になった。"]
    ]
  },
  shiryokan: {
    next: "boss",
    lines: [
      ["kaguya", "資料館には、この町の歴史が大切に残されています。"],
      ["sawara", "……よく来た。ここで、私と向き合ってもらおう。"]
    ]
  },
  boss: {
    next: "ed",
    lines: [
      ["sawara", "私の無念を、あなたは受け止められるか。"],
      ["kaguya", "大丈夫。あなたの歩いてきた道が、答えになります。"],
      ["sawara", "……そうか。ならば、もう迷わずに行ける。"]
    ]
  },
  ed: {
    next: "end",
    lines: [
      ["kaguya", "ありがとう。物語はここでおしまいです。"],
      ["kaguya", "これからは、好きなときにこの町を歩いてくださいね。"]
    ]
  }
};

// 章を進める順番(マップのピンと対応)
export const pinOrder = ["nagaoka", "shiryokan"];
