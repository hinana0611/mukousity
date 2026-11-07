# CLAUDE.md

向日市(京都府)を舞台にした、スマホ縦画面向けのストーリー型Webゲーム。授業(地域共創)の制作物。
詳しい仕様は [README.md](README.md) を参照。ただし README の AI会話の節(ダミー実装・中継サーバー)は古く、現在の `js/chat.js` はブラウザ内AI(WebLLM)で動く。

## 技術構成

- ビルドなし・依存インストールなしの素の HTML / CSS / ES Modules。フレームワークは使わない
- 外部は CDN から読み込む: Leaflet 1.9.4 + OpenStreetMap タイル(地図)、`@mlc-ai/web-llm`(esm.run、AI会話)、Google Fonts
- 状態は `localStorage`(キー `mukou-game`)。サーバー側の処理はない
- 公開は GitHub Pages 想定。リポジトリは公開なので、APIキーや秘密情報は絶対に入れない

## 動かし方

- `import` が `file://` では動かないので、ローカルHTTPサーバーで開く(VS Code の Live Server、または `python -m http.server`)
- デバッグモードは、タイトル画面の「デバッグモード」ボタンで ON/OFF できる(`localStorage` の `mukou-debug` に保存)。URL に `?debug=1` を付けても ON になる。ON のときは右はしに小さな🛠タブが出て、押すと章スキップなどのボタンが開く(ミニゲーム中は隠れる。`#app` の `data-screen` で判定)。ミニゲームの画面には、ゲームを「クリア扱い」にするボタンが条件付きで出る(`js/main.js` の dbg* 関数)
- AIの返事は `js/chat.js` の `REPLY_RULE`(短く答える指示)と `tidy()`(Markdown を外し、`MAX_REPLY_CHARS` 文字で文の終わりに切る)で短くしている
- テストフレームワークはない。動作確認はブラウザで行う

## ファイルの役割

| ファイル | 役割 |
| --- | --- |
| `index.html` | 全画面の骨組み。`APP_VERSION` とキャッシュ対策の importmap を持つ |
| `js/main.js` | 画面切り替え、会話の再生、章の進行、ホーム・マップ・会話画面、デバッグ |
| `js/state.js` | 進捗(`done` / `cleared` / `unlockedPins`)の保存と読み込み、`progress()` |
| `js/story.js` | キャラ定義 `characters`、章データ `chapters`、章の順番 `chapterOrder` |
| `js/map.js` | Leaflet の地図とピン `pins`(どのピンでどの章が始まるか) |
| `js/games.js` | ミニゲームの登録(id → `start` 関数) |
| `js/typer.js` | 文字を1文字ずつ出す仕組み。会話の枠・AI会話の枠で共通。枠に入りきらない文はページに分け、タップで次のページへ |
| `js/games/kit.js` | Canvasゲーム(弾幕・ランナー)共通の土台: 操作・60fpsループ・後始末 |
| `js/games/*.js` | 各ミニゲーム本体 |
| `js/chat.js` / `js/chat-worker.js` | AI会話(かぐや)。WebLLM を Web Worker で動かす |
| `image/*.PNG` | 元の立ち絵(4608×6144・約7MB。重いので画面では使わない) |
| `img/*.webp` | 画面で使う立ち絵(高さ1000px・約80KB)。かぐやは `kaguya_normal` / `kaguya_laugh` / `kaguya_think` の3表情 |
| `knowledge/*.txt` | AI会話に渡す知識テキスト。`system_rule.txt` がキャラ設定・ルール、`summary.txt` が常に渡す概要 |

## 物語の流れ

プロローグ → 5章(`chapterOrder`: `sawara1` → `taira` → `sugawara` → `sutoku` → `sawara2`)→ ED → クリア後モード(全ピン開放・自由会話・ホームの「ミニゲーム」ボタンから各ゲームを何回でも遊べる。`js/main.js` の `openGames()` / `runGame(id, { replay: true })`。replay ではストーリーは進めない)。
章は `lines`(ゲーム前の会話)→ `game` → `after`(クリア後の会話)→ `next` の順に進む。`anyResult: true` は負けイベント(勝敗に関係なく進む)。

## 変更するときの決まり

- **ファイルを更新したら `index.html` の `window.APP_VERSION` を1つ上げる**(スマホが古いキャッシュを使い続けないように)
- **`js/` に新しい `.js` を足したら、`index.html` の `files` 配列にも追加する**(importmap に載らないとバージョン付きで読まれない)
- 章を増減したら `js/state.js` の `TOTAL`(プロローグ + 章 + ED の数、現在7)を合わせる
- ミニゲームは `start(box, onFinish, opts)` の形にそろえ、終了時に `onFinish("clear" | "fail")` を呼び、後始末用の関数を返す。`js/games.js` の `impl` に登録する。未登録の id は仮ゲーム(クリア/失敗ボタン)になる
- Canvas系ゲームは `kit.js` の `createStage` を使い、離れるときに `destroy()` でタイマー・イベントを全部外す
- Canvas系ゲームの絵は `kit.js` の部品(`makeNightSky` / `drawOnryo` / `drawOrb` / `drawPetal` / `drawHeart` / `drawBar` / `drawBigText` / `roundRectPath`)で描く。見た目だけを変え、当たり判定の数字(`size`・`w`/`h`)は変えない(難しさが変わるため)。敵は怨霊なので、かわいくしすぎない(`drawOnryo` は長い黒髪・赤く光る目・牙・人魂でこわさを残している)
- AI会話の知識を増やすときは `knowledge/` にテキストを置き、`js/chat.js` の `RULES`(質問のキーワード → 渡すファイル)に追加する。サブフォルダを足したら `SEARCH_DIRS` にも追加する
- AIのデータ(約1GB)は、会話画面で本人が「ダウンロードして話す」を選んだときだけ読み込む(許可は `localStorage` の `mukou-ai-ok` に保存)。黙ってダウンロードを始めない
- 知識ファイルを AI に渡す量は `MAX_EXTRA_CHARS` で制限している(小さなAIが一度に読める量を超えないように)
- 確認には `confirm()` を使わず、`js/main.js` の `ask(msg, { yes, no })`(Promise で true/false。ゲームの見た目の窓)を使う。窓が出ているあいだは `kit.js` の `pauseGames()` で Canvas系ゲームが止まる
- `css/style.css` に `[hidden] { display: none !important; }` があるので、表示の切り替えは `hidden` 属性で行う
- `localStorage` の読み書きは try/catch で囲む。古い保存データ(存在しない章id)は読み込み時に捨てる方針
- コメント・UI文言は日本語。コード内コメントは、中学生でも読めるくらいのやさしい言葉で書くのが既存のスタイル
- `js/story.js` で `【HAPPY END】` のように【】だけの行は、会話の枠のまん中に筆記体(Google Fonts の Great Vibes)で大きく、1文字ずつではなく一気に出る(`#textbox.ending`)
- 縦画面前提(`100dvh`)。ボタンは指で押しやすい大きさに
- 色は `css/style.css` の `:root`(夜空の藍色 `--ink`/`--panel`、桜色 `--sakura`/`--rose`、月の金色 `--moon`)を使う
- 立ち絵を足すときは、`image/` の元画像を、表情どうしで同じ範囲を切り抜いてから高さ1000pxの WebP にして `img/` に置き(Pillow を使用)、`js/story.js` の `characters` の `image` / `poses` に書く。表情は `js/main.js` の `poseFor()` がセリフの言葉で選ぶ。タイトルはポーズ1(`kaguya_think`)を1.6倍・ホームは1.5倍・AI会話は2.1倍で顔と上半身中心(`background-size` の %)、ストーリーの会話(`#dialog`)とAI会話(`#chat`)は上半身だけ(`background-size: auto 180%` で拡大し、下と左右をマスクでぼかす)
- 会話の枠(`.textbox`)は高さ固定(名前1行 + 本文5行)。本文は `textContent` に直接入れず、`createTyper` の `set()` を通す(1文字ずつ表示・ページ分けのため)。何度も変わる文(読み込みの % など)は `{ instant: true }` で出す。行の折り返しは `typer.js` の `phrase()` が言葉の区切り(ひらがな→漢字・カタカナの変わり目、、。の後)に目に見えないしるしを入れ、CSS の `word-break: keep-all` でそこだけで改行する。変な所で切れる言葉があれば `phrase()` のルールに足す。好きな所で改行したいときは、`story.js` のセリフに `\n` を書く(文の終わりで改行すると読みやすい。1つのセリフは、スマホ幅で枠に収まる5行以内が目安)
