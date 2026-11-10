import { state, progress, markDone, markSeen, finishGame, restartStory, resetAll } from "./state.js";
import { characters, chapters, chapterOrder } from "./story.js";
import { showMap } from "./map.js";
import { initChat, sendMessage, resetChat } from "./chat.js";
import { startGame, titles as gameTitles } from "./games.js";
import { pauseGames } from "./games/kit.js";
import { createTyper, phrase } from "./typer.js";

const $ = id => document.getElementById(id);
const order = ["prologue", ...chapterOrder, "ed"];

// 文字を1文字ずつ出す枠(会話の枠と、AI会話の枠)。長い文は枠に入る長さでページに分ける
const dialogTyper = createTyper({ box: $("textbox"), textEl: $("text"), moreEl: $("dialogMore") });
const chatTyper = createTyper({ box: $("chatBox"), textEl: $("chatText"), moreEl: $("chatMore") });

// クリア後モード = EDまで終えている状態(「はじめから」でやり直すと通常モードに戻る)
const freeMode = () => state.cleared && state.done.includes("ed");

/* ---------- 画面切り替え ---------- */
let stopGame = null; // 遊んでいるゲームを止める関数
function show(name) {
  closeAsk(false); // 確認の窓が出ていたら閉じる
  if (name !== "game" && stopGame) { stopGame(); stopGame = null; }
  if (name !== "game") dbgHide();
  if (name !== "dialog") dialogTyper.stop();
  if (name !== "chat") chatTyper.stop();
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === name));
  $("app").dataset.screen = name; // CSS で「いまどの画面か」を使えるように(ゲーム中はデバッグを隠す、など)
  setDbgMenu(false);              // 画面が変わったら、デバッグメニューはたたむ
  $("menu").hidden = true;
}

/* ---------- スマホの画面の大きさに合わせる ----------
   画面の高さ(--app-h)を、いまの画面の内側の高さにそろえる(100dvh が使えない古いスマホでも、ぴったりになるように) */
function setAppHeight() {
  document.documentElement.style.setProperty("--app-h", window.innerHeight + "px");
}
setAppHeight();
window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", () => setTimeout(setAppHeight, 300));

// ミニゲームが画面に入りきらないときは、まるごと小さくして、ぴったり収める(上下にスクロールさせない)
function fitGame() {
  const box = $("gameBox"), el = box.firstElementChild;
  if (!el) return;
  el.style.zoom = "";
  el.style.width = "";
  const cs = getComputedStyle(box);
  const room = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const w = el.offsetWidth, h = el.offsetHeight;
  if (h > room && room > 0) {
    // 横幅を、いまの幅のまま止めてから小さくする(止めないと、小さくした分だけ横に広がって、縦も伸びてしまう)
    el.style.width = w + "px";
    el.style.zoom = String(Math.floor(room / h * 1000) / 1000);
  }
}
const fitObserver = new ResizeObserver(() => setTimeout(fitGame, 0));
fitObserver.observe($("gameBox"));
window.addEventListener("resize", () => setTimeout(fitGame, 0));
// ゲームが入れかわったら、中身の大きさも見張る(必殺技ボタンが出たときなど)
new MutationObserver(() => {
  const el = $("gameBox").firstElementChild;
  if (el) fitObserver.observe(el);
  fitGame();
}).observe($("gameBox"), { childList: true });

/* ---------- 確認の窓(ブラウザの confirm の代わり。ゲームの見た目に合わせた窓) ----------
   使い方: if (await ask("やめますか?")) { … }
   はい → true / いいえ・窓の外を押す・Esc → false。窓が出ているあいだ、ゲームは一時停止する */
let askDone = null;
function ask(msg, { yes = "はい", no = "いいえ" } = {}) {
  closeAsk(false);
  $("askMsg").textContent = msg;
  $("askYes").textContent = yes;
  $("askNo").textContent = no;
  $("ask").hidden = false;
  pauseGames(true);
  $("askNo").focus();
  return new Promise(resolve => { askDone = resolve; });
}
function closeAsk(answer) {
  if (!askDone) return;
  const done = askDone;
  askDone = null;
  $("ask").hidden = true;
  pauseGames(false);
  done(answer);
}
$("askYes").onclick = () => closeAsk(true);
$("askNo").onclick = () => closeAsk(false);
$("ask").addEventListener("click", e => { if (e.target.id === "ask") closeAsk(false); }); // 窓の外を押したら「いいえ」
document.addEventListener("keydown", e => { if (askDone && e.key === "Escape") { e.stopPropagation(); closeAsk(false); } }, true);

// セリフに合わせて表情を選ぶ(poses がないキャラは、いつもの image)
//   笑顔: 「ふふ」「ありがとう」など / 考え顔: 「？」「おや」「大変」など / それ以外: ふつう
function poseFor(c, text = "") {
  if (!c.poses) return c.image;
  if (/ふふ|うふ|ありがとう|よかった|嬉しい|楽しい|♪|しましょうね|行きましょう|はい！|はーい/.test(text)) return c.poses.laugh;
  if (/[？?]|おや|あら|大変|うーん|分から|待って/.test(text)) return c.poses.think;
  return c.poses.normal;
}

// text … そのキャラが話しているセリフ(表情を選ぶのに使う) / pose … 表情を決めたいとき("think" など)
function setChara(el, key, speaking, dim = false, text = "", pose = "") {
  const c = characters[key];
  const image = c ? (pose && c.poses?.[pose]) || poseFor(c, text) : "";
  el.textContent = c && !image ? c.initial : "";
  el.style.backgroundImage = image ? `url(${image})` : "";
  el.classList.toggle("hasImg", !!image); // 画像のときは、枠を消して立ち絵として見せる
  el.classList.toggle("speak", !!speaking);
  el.classList.toggle("dim", !!dim);
}

// 表情を切り替えたときにチラつかないよう、画像を先に読み込んでおく
Object.values(characters).forEach(c => {
  [c.image, ...Object.values(c.poses ?? {})].filter(Boolean).forEach(src => { new Image().src = src; });
});
new Image().src = "img/title_illust.webp"; // タイトル・ハッピーエンドの一枚絵
new Image().src = "img/onryo_cloud.webp"; // まだ救っていない子にかぶせる、怨霊の雲

/* ---------- タイトル ---------- */
function showTitle() {
  // セーブがあれば「続きから」「はじめから」、なければ「ゲームstart」だけ
  const hasSave = state.done.length > 0;
  $("start").textContent = hasSave ? "続きから" : "ゲームstart";
  $("restart").hidden = !hasSave;
  $("ver").textContent = "ver." + (window.APP_VERSION ?? "?"); // いまのスマホが読んでいる版が分かる
  // タイトルは、ヒロインたちが並んだタイトル用のイラスト(img/title_illust.webp)
  $("titleChara").style.backgroundImage = "url(img/title_illust.webp)";
  show("title");
}

$("start").onclick = () => {
  preloadChat();
  if (freeMode()) return showHome();
  const next = order.find(id => !state.done.includes(id));
  // プロローグとEDは会話から再開。ほかの章はマップのピンから始める
  if (next === "prologue" || next === "ed") return playChapter(next);
  showHome();
};

$("restart").onclick = async () => {
  if (!await ask("はじめからやり直します。\nいまの進捗はリセットされます。よろしいですか?", { yes: "やり直す", no: "やめておく" })) return;
  preloadChat();
  restartStory();
  resetChat(); // 前の会話を覚えたままにしない
  playChapter("prologue");
};

/* ---------- 会話(プロローグ・各章の前後・ED共通) ---------- */
// lines の話す人は "taira" や "taira:怨"(名前に(怨)が付く)の形
// scene … "sawara1:lines" のような場面の名前。はじめて見る場面はスキップできない(2回目から、またはデバッグモードのとき)
// cg … 【HAPPY END】のような行で、立ち絵のかわりに出す一枚絵(story.js の章の cg)
// haunt … 怨霊の雲をかぶせるキャラ(まだ救っていない子。["taira"] など)
function playLines(lines, { stagger = false, onEnd, scene = "", cg = "", haunt = [] }) {
  const keys = lines.map(l => l[0].split(":")[0]);
  // 画面に映すのは、主人公・地の文などを除いた最大2人
  const shown = [...new Set(keys)].filter(k => !characters[k]?.hidden).slice(0, 2);
  let i = 0;
  let ended = false; // 最後まで進んだら true(すばやい2回タップで、次の場面を飛ばさないように)
  $("dialogStage").classList.toggle("stagger", stagger && shown.length === 2);

  const render = () => {
    const [who, text] = lines[i];
    const key = who.split(":")[0];
    // 暗くするのは、2人映っていて、そのどちらかが話しているときの「話していない方」だけ
    const dimOthers = shown.length === 2 && shown.includes(key);
    setChara($("charaL"), shown[0], key === shown[0], dimOthers && key !== shown[0], key === shown[0] ? text : "");
    setChara($("charaR"), shown[1], key === shown[1], dimOthers && key !== shown[1], key === shown[1] ? text : "");
    $("charaL").classList.toggle("haunt", haunt.includes(shown[0]));
    $("charaR").classList.toggle("haunt", haunt.includes(shown[1]));
    $("who").textContent = speakerName(who);
    // 【HAPPY END】のような行は、枠のまん中に、筆記体で大きく出す
    const ending = text.match(/^【(.+)】$/);
    $("textbox").classList.toggle("ending", !!ending);
    const showCg = !!(ending && cg);
    $("dialogStage").classList.toggle("cg", showCg);
    $("dialogCg").hidden = !showCg;
    $("dialogCg").style.backgroundImage = showCg ? `url(${cg})` : "";
    if (ending) dialogTyper.set(toTitleCase(ending[1]), { instant: true, phrase: false }); // エンディングは一気に出す
    else dialogTyper.set(text); // 左から1文字ずつ
  };
  const end = () => {
    if (ended) return;
    ended = true;
    dialogTyper.stop();
    if (scene) markSeen(scene); // 最後まで見たので、次からはスキップできる
    onEnd();
  };

  $("textbox").onclick = () => {
    if (ended) return;
    if (dialogTyper.tap()) return; // 文字を出している途中・続きのページがあるときは、まずそちら
    if (++i < lines.length) return render();
    end();
  };
  // ログ: この場面で、いままでに出たセリフを読み返す
  $("logBtn").onclick = e => {
    e.stopPropagation();
    showLog(lines.slice(0, i + 1));
  };
  // スキップ: この場面の会話を最後まで飛ばす(一度見た場面だけ)
  $("skipBtn").hidden = !!scene && !state.seen.includes(scene) && !dbgOn;
  $("skipBtn").onclick = e => {
    e.stopPropagation();
    end();
  };

  $("log").hidden = true;
  show("dialog");
  render();
}

// "HAPPY END" → "Happy End"(筆記体は、大文字だけだと読みにくいので)
const toTitleCase = s => s.replace(/[A-Za-z]+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());

// "taira:怨" → 「平将門(怨)」
function speakerName(who) {
  const [key, tag] = who.split(":");
  const name = characters[key].name;
  return name && tag ? `${name}(${tag})` : name;
}

function showLog(lines) {
  const list = $("logList");
  list.replaceChildren(...lines.map(([who, text]) => {
    const item = document.createElement("div");
    item.className = "logItem";
    const name = document.createElement("b");
    name.textContent = speakerName(who);
    const p = document.createElement("p");
    p.textContent = phrase(text); // ログも、言葉のきりがいいところで改行
    item.append(name, p);
    return item;
  }));
  $("log").hidden = false;
  list.scrollTop = list.scrollHeight; // いちばん新しいセリフを見せる
}
$("log").onclick = () => { $("log").hidden = true; };

// パソコンでは、Enter・スペースでも会話を進められる(Esc でログを閉じる)
document.addEventListener("keydown", e => {
  if (!$("dialog").classList.contains("on") || e.target.closest?.("input, textarea")) return;
  if (!$("log").hidden) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); $("log").hidden = true; }
    return;
  }
  if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
    e.preventDefault();
    $("textbox").click();
  }
});

// 章の主役のキャラ("sawara2" → "sawara")。プロローグ・EDは主役なし
const heroineOf = id => (chapterOrder.includes(id) ? id.replace(/\d+$/, "") : "");

// 章の会話 → ゲーム → (クリア後の会話) → 次へ
// ゲームをクリアするまでは、主役の子に怨霊の雲をかぶせる
function playChapter(id) {
  const ch = chapters[id];
  playLines(ch.lines, {
    scene: id + ":lines",
    cg: ch.cg,
    haunt: [heroineOf(id)],
    stagger: id === "sawara1" || id === "sawara2",
    onEnd: () => (ch.game ? runGame(id) : finishChapter(id))
  });
}

function playAfter(id) {
  playLines(chapters[id].after, {
    scene: id + ":after",
    haunt: chapters[id].anyResult ? [heroineOf(id)] : [], // 負けイベントのあとは、まだ救えていない
    stagger: id === "sawara1" || id === "sawara2",
    onEnd: () => finishChapter(id)
  });
}

// 章を終えて次へ
function finishChapter(id) {
  const ch = chapters[id];
  markDone(id);
  if (ch.next === "home") showHome();
  else if (ch.next === "end") { finishGame(); showHome(); }
  else playChapter(ch.next);
}

/* ---------- ミニゲーム ---------- */
// replay: true … ミニゲーム一覧から遊ぶとき(ストーリーは進めず、終わったら結果を出す)
let replaying = false;
function runGame(id, { replay = false } = {}) {
  if (stopGame) { stopGame(); stopGame = null; }
  replaying = replay;
  show("game");
  // 一覧から遊ぶときは、左上に「ミニゲーム一覧へ」戻るボタン。ストーリーのときは右上の「やめる」
  $("quitGame").textContent = replay ? "← ミニゲーム一覧へ" : "✕ やめる";
  $("quitGame").classList.toggle("back", replay);
  $("gameResult").hidden = true;
  dbgStart(id);
  const ch = chapters[id];
  // 結果の窓を出す(win: true ならクリア。かぐやが笑顔になる)
  const showResult = (msg, win) => {
    $("resultMsg").textContent = msg;
    $("gameResult").classList.toggle("win", win);
    $("gameResult").hidden = false;
    $("retryBtn").onclick = () => runGame(id, { replay });
    $("toMapBtn").textContent = replay ? "ミニゲーム一覧へ" : "マップへ";
    $("toMapBtn").onclick = replay ? openGames : openMap;
  };
  const onResult = result => {
    if (replay) {
      if (result !== "clear") dbgMiss();
      return showResult(result === "clear" ? "クリア！ おめでとう！" : "失敗……もう一度挑戦しますか?", result === "clear");
    }
    // anyResult(負けイベント)は、勝っても負けても先へ進む
    if (result === "clear" || ch.anyResult) return ch.after ? playAfter(id) : finishChapter(id);
    dbgMiss();
    showResult("失敗……もう一度挑戦しますか?", false);
  };
  dbgClearFn = () => onResult("clear");
  stopGame = startGame(ch.game, $("gameBox"), onResult);
}

/* ---------- デバッグ用: ゲームを「クリア扱い」にするボタン(デバッグモードのとき) ----------
   ・スライドパズル … ゲームを始めて20秒たつと出る
   ・そのほか(ワード探し・RUN ESCAPE・ラスボス) … 1回失敗すると出る
     (ワード探しは失敗がないので、まちがった言葉を1回選ぶと出る)
   ・チュートリアル(第一章の弾幕)には出ない */
// デバッグモード: タイトルのボタンで ON/OFF(次に開いたときも覚えている)。URL に ?debug=1 でも ON になる
const DEBUG_KEY = "mukou-debug";
let dbgOn = new URLSearchParams(location.search).has("debug") ||
  (() => { try { return localStorage.getItem(DEBUG_KEY) === "1"; } catch { return false; } })();
let dbgTimer = null, dbgFails = 0, dbgGameId = null, dbgClearFn = null;

function dbgHide() {
  clearTimeout(dbgTimer);
  $("dbgClear").hidden = true;
}
function dbgStart(id) {
  dbgHide();
  if (dbgGameId !== id) { dbgGameId = id; dbgFails = 0; } // 同じ章のやり直しでは、失敗の数を引き継ぐ
  const game = chapters[id].game;
  if (!dbgOn || game === "danmaku_tutorial") return;
  if (game === "slide_puzzle") dbgTimer = setTimeout(() => { $("dbgClear").hidden = false; }, 20000);
  else if (dbgFails > 0) $("dbgClear").hidden = false;
}
function dbgMiss() { // 失敗が1回あったとき
  if (!dbgOn || !dbgGameId) return;
  const game = chapters[dbgGameId].game;
  if (game === "danmaku_tutorial") return;
  dbgFails++;
  if (game !== "slide_puzzle") $("dbgClear").hidden = false;
}
$("dbgClear").onclick = () => { if (dbgClearFn) dbgClearFn(); };

// ゲームの途中でやめて、ホームに戻る(show() がゲームを止める)
// (ミニゲーム一覧から遊んでいるときは、一覧に戻る)
$("quitGame").onclick = async () => {
  const where = replaying ? "ミニゲーム一覧" : "ホーム";
  if (!await ask(`ゲームをやめて、${where}に戻りますか?`, { yes: "戻る", no: "続ける" })) return;
  if (replaying) openGames(); else showHome();
};

/* ---------- ミニゲーム一覧(ストーリーを最後まで終えたあと) ---------- */
// 章の順に、ゲームの名前・章・相手の名前をボタンにして並べる
function openGames() {
  const list = $("gameList");
  list.replaceChildren(...chapterOrder.filter(id => chapters[id].game && !chapters[id].anyResult) /* 負けイベント(チュートリアル)は入れない */.map(id => {
    const who = characters[id.replace(/\d+$/, "")]?.name ?? ""; // "sawara1" → "sawara"
    // 章の番号は、ストーリーの章の順(チュートリアルの第一章も数える)
    const n = chapterOrder.indexOf(id);
    const no = n === chapterOrder.length - 1 ? "最終章" : `第${"一二三四五六七八九"[n]}章`;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gameCard";
    b.innerHTML = `<b></b><span></span>`;
    b.querySelector("b").textContent = gameTitles[chapters[id].game] ?? chapters[id].game;
    b.querySelector("span").textContent = `${no}・${who}`;
    b.onclick = () => runGame(id, { replay: true });
    return b;
  }));
  show("games");
}
$("gameBox").addEventListener("gamemiss", dbgMiss); // ワード探しの「まちがい」

/* ---------- ホーム ---------- */
function showHome() {
  const p = progress();
  $("barFill").style.width = p + "%";
  $("barText").textContent = p + "%";
  setChara($("homeChara"), "kaguya", true);
  // クリア後は「次のストーリー」がないので、ミニゲームの案内にする
  $("homeGames").hidden = !freeMode(); // 「ミニゲーム」は、ストーリーを最後まで終えたら出る
  $("homeHint").textContent = freeMode()
    ? "ミニゲームで、もう一度遊べるよ"
    : "マップから次のストーリーに進もう";
  show("home");
}



document.addEventListener("click", e => {
  // ☰ で開閉。メニューの外を押したら閉じる
  if (e.target.closest(".menuBtn")) $("menu").hidden = !$("menu").hidden;
  else if (!e.target.closest("#menu")) $("menu").hidden = true;
  document.querySelectorAll(".menuBtn").forEach(b => b.setAttribute("aria-expanded", String(!$("menu").hidden)));

  const go = e.target.closest("[data-go]")?.dataset.go;
  if (go === "title") showTitle();
  if (go === "home") showHome();
  if (go === "map") openMap();
  if (go === "chat") openChat();
  if (go === "games") openGames();
});

/* ---------- マップ ---------- */
const nextChapter = () => chapterOrder.find(id => !state.done.includes(id));

function pinStatus(pin) {
  if (freeMode()) return "open";
  if (!state.unlockedPins.includes(pin.id)) return "locked";
  // chapters(配列)が基本。古い書き方の chapter(1つ)でも動くようにしておく
  const chs = pin.chapters ?? (pin.chapter ? [pin.chapter] : []);
  if (chs.includes(nextChapter())) return "next";
  // 1回でも訪れた場所は、解説を見られる(長岡宮跡は最終章の前でも見られる)
  return chs.some(c => state.done.includes(c)) ? "open" : "locked";
}

// 少しの間だけ表示する(前のタイマーは止めてから。続けて押しても、すぐ消えないように)
const timers = {};
function flash(el, msg, ms) {
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(timers[el.id]);
  timers[el.id] = setTimeout(() => { el.hidden = true; }, ms);
}

function onPin(pin) {
  const status = pinStatus(pin);
  if (status === "locked") return flash($("toast"), "ここにはまだ行けません", 2200);
  if (status === "next") return playChapter(nextChapter());
  // クリア後・訪問済み: ストーリーは進めず、解説を表示する
  flash($("spot"), `${pin.name}:${pin.info}`, 4000);
}

function openMap() {
  show("map");
  $("spot").hidden = true;
  $("toast").hidden = true;
  showMap(onPin, pinStatus);
}

/* ---------- AI会話 ---------- */
// かぐやの返事を出す。instant: true なら1文字ずつにせず、すぐ全部出す(読み込みの % など、何度も変わる文)
function say(text, { instant = false } = {}) {
  $("chatWho").textContent = characters.kaguya.name; // 1行目: 名前
  chatTyper.set(text, { instant });                  // 2行目から: 返事
  setChara($("chatChara"), "kaguya", true, false, text); // 返事に合わせて表情も変える
}
// 枠を押すと: 文字を出している途中なら全部出す / 続きのページがあれば次へ
$("chatBox").onclick = () => chatTyper.tap();

const chatGreeting = () => (freeMode() ? "向日市のこと、なんでも話しましょう。" : "こんにちは。何か気になることはありますか?");
let chatState = "idle"; // "idle"(まだ) → "loading"(AIを読み込み中) → "ready"(話せる)
const setChatEnabled = on => { $("msg").disabled = !on; $("send").disabled = !on; };

// AIのデータ(約1GB)をダウンロードしてよいか。一度「はい」と答えたら覚えておく
const AI_OK_KEY = "mukou-ai-ok";
const aiAllowed = () => { try { return localStorage.getItem(AI_OK_KEY) === "1"; } catch { return false; } };

// 前にダウンロードを許可してくれた人だけ、会話画面を開く前に裏で読み込みを始めておく
// (2回目からはブラウザに保存済みなので速い)。通信量を節約する設定のスマホでは待つ
function preloadChat() {
  if (chatState !== "idle" || !aiAllowed()) return;
  if (navigator.connection && navigator.connection.saveData) return;
  startChat(true);
}

// useAI: true … AIを読み込む / false … かんたんモード(ダウンロードしない)
function startChat(useAI) {
  chatState = "loading";
  setChatEnabled(false);
  $("chatConsent").hidden = true;
  say(useAI ? "かぐやを呼んでいます……(初回は数分かかります)" : "はーいちょっと待ってね！");
  initChat(text => say(text, { instant: true }), useAI).then(result => {
    chatState = "ready";
    setChatEnabled(true);
    say(result.ai ? chatGreeting() : result.notice + "\n" + chatGreeting());
  });
}

// はじめて会話画面を開いたとき、ダウンロードしてよいかを聞く
function askDownload() {
  setChatEnabled(false);
  say("私とじっくりおしゃべりするには、AIのデータ(約1GB)のダウンロードが必要です。Wi-Fi につないでいると安心ですよ。2回目からはダウンロードしません。");
  $("chatConsent").hidden = false;
}
$("aiYes").onclick = () => {
  try { localStorage.setItem(AI_OK_KEY, "1"); } catch {}
  startChat(true);
};
$("aiNo").onclick = () => startChat(false);

function openChat() {
  $("chatTitle").textContent = freeMode() ? "自由会話" : "会話";
  setChara($("chatChara"), "kaguya", true);
  show("chat");
  if (chatState === "idle") aiAllowed() ? startChat(true) : askDownload();
  else if (chatState === "ready" && !chatTyper.text) say(chatGreeting());
  // 画面に出ていない間に届いた文は、枠の大きさを測れていないので、ページに分け直す
  else chatTyper.refresh();
}

async function send() {
  if ($("send").disabled) return; // 返事を待っている間・準備中は送らない(Enter の連打で二重に送らないように)
  const input = $("msg");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  input.blur(); // スマホのキーボードを閉じて、返事が見えるようにする
  say("はーいちょっと待ってね！", { instant: true });
  $("send").disabled = true;
  try {
    say(await sendMessage(text, freeMode() ? "free" : "story"));
  } catch {
    say("うまく返事ができませんでした。もう一度送ってください。");
  }
  $("send").disabled = false;
}
$("send").onclick = send;
$("msg").addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) send(); });

/* ---------- デバッグ(タイトルの「デバッグモード」ボタン、または URL に ?debug=1) ---------- */
// デバッグメニューを開く / たたむ
function setDbgMenu(open) {
  $("dbgMenu").hidden = !open;
  document.querySelector(".dbgTab").setAttribute("aria-expanded", String(open));
}
$("debug").onclick = e => {
  const act = e.target.dataset.dbg;
  if (act === "toggle") return setDbgMenu($("dbgMenu").hidden);
  if (act === "skip") {
    const id = order.find(c => !state.done.includes(c));
    if (id) { markDone(id); if (id === "ed") finishGame(); }
    showHome();
  }
  if (act === "clear") { order.forEach(markDone); finishGame(); showHome(); }
  if (act === "reset") { resetAll(); resetChat(); showTitle(); }
};

// ON/OFF に合わせて、デバッグ用のボタンを出したり消したりする
function applyDebug() {
  $("debug").hidden = !dbgOn;
  $("dbgToggle").textContent = "デバッグモード: " + (dbgOn ? "ON" : "OFF");
  $("dbgToggle").classList.toggle("on", dbgOn);
  if (dbgOn) window.__pc = playChapter; // コンソールから好きな章を始める用: __pc("sutoku")
  else delete window.__pc;
  if (!dbgOn) dbgHide();
}
$("dbgToggle").onclick = () => {
  dbgOn = !dbgOn;
  try { dbgOn ? localStorage.setItem(DEBUG_KEY, "1") : localStorage.removeItem(DEBUG_KEY); } catch {}
  applyDebug();
};

applyDebug();
showTitle();
