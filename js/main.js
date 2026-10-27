import { state, progress, markDone, finishGame, restartStory, resetAll } from "./state.js";
import { characters, chapters, chapterOrder } from "./story.js";
import { showMap } from "./map.js";
import { sendMessage } from "./chat.js";
import { startGame } from "./games.js";

const $ = id => document.getElementById(id);
const order = ["prologue", ...chapterOrder, "ed"];

// クリア後モード = EDまで終えている状態(「はじめから」でやり直すと通常モードに戻る)
const freeMode = () => state.cleared && state.done.includes("ed");

/* ---------- 画面切り替え ---------- */
let stopGame = null; // 遊んでいるゲームを止める関数
function show(name) {
  if (name !== "game" && stopGame) { stopGame(); stopGame = null; }
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === name));
  $("menu").hidden = true;
}

function setChara(el, key, speaking, dim = false) {
  const c = characters[key];
  el.textContent = c && !c.image ? c.initial : "";
  el.style.backgroundImage = c && c.image ? `url(${c.image})` : "";
  el.classList.toggle("speak", !!speaking);
  el.classList.toggle("dim", !!dim);
}

/* ---------- タイトル ---------- */
function showTitle() {
  // セーブがあれば「続きから」「はじめから」、なければ「ゲームstart」だけ
  const hasSave = state.done.length > 0;
  $("start").textContent = hasSave ? "続きから" : "ゲームstart";
  $("restart").hidden = !hasSave;
  setChara($("titleChara"), "kaguya", true);
  show("title");
}

$("start").onclick = () => {
  if (freeMode()) return showHome();
  const next = order.find(id => !state.done.includes(id));
  // プロローグとEDは会話から再開。ほかの章はマップのピンから始める
  if (next === "prologue" || next === "ed") return playChapter(next);
  showHome();
};

$("restart").onclick = () => {
  if (!confirm("はじめからやり直します。いまの進捗はリセットされます。よろしいですか?")) return;
  restartStory();
  playChapter("prologue");
};

/* ---------- 会話(プロローグ・各章の前後・ED共通) ---------- */
// lines の話す人は "taira" や "taira:怨"(名前に(怨)が付く)の形
function playLines(lines, { stagger = false, onEnd }) {
  const keys = lines.map(l => l[0].split(":")[0]);
  // 画面に映すのは、主人公・地の文などを除いた最大2人
  const shown = [...new Set(keys)].filter(k => !characters[k]?.hidden).slice(0, 2);
  let i = 0;
  $("dialogStage").classList.toggle("stagger", stagger && shown.length === 2);

  const render = () => {
    const [who, text] = lines[i];
    const [key, tag] = who.split(":");
    // 暗くするのは、2人映っていて、そのどちらかが話しているときの「話していない方」だけ
    const dimOthers = shown.length === 2 && shown.includes(key);
    setChara($("charaL"), shown[0], key === shown[0], dimOthers && key !== shown[0]);
    setChara($("charaR"), shown[1], key === shown[1], dimOthers && key !== shown[1]);
    const name = characters[key].name;
    $("who").textContent = name && tag ? `${name}(${tag})` : name;
    $("text").textContent = text;
  };

  $("textbox").onclick = () => {
    if (++i < lines.length) return render();
    onEnd();
  };

  show("dialog");
  render();
}

// 章の会話 → ゲーム → (クリア後の会話) → 次へ
function playChapter(id) {
  const ch = chapters[id];
  playLines(ch.lines, {
    stagger: id === "sawara1" || id === "sawara2",
    onEnd: () => (ch.game ? runGame(id) : finishChapter(id))
  });
}

function playAfter(id) {
  playLines(chapters[id].after, {
    stagger: id === "sawara2",
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
function runGame(id) {
  if (stopGame) { stopGame(); stopGame = null; }
  show("game");
  $("gameResult").hidden = true;
  const ch = chapters[id];
  stopGame = startGame(ch.game, $("gameBox"), result => {
    // anyResult(負けイベント)は、勝っても負けても先へ進む
    if (result === "clear" || ch.anyResult) return ch.after ? playAfter(id) : finishChapter(id);
    $("resultMsg").textContent = "失敗……もう一度挑戦しますか?";
    $("gameResult").hidden = false;
    $("retryBtn").onclick = () => runGame(id);
    $("toMapBtn").onclick = showHome;
  });
}

/* ---------- ホーム ---------- */
function showHome() {
  const p = progress();
  $("barFill").style.width = p + "%";
  $("barText").textContent = p + "%";
  setChara($("homeChara"), "kaguya", true);
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
});

/* ---------- マップ ---------- */
const nextChapter = () => chapterOrder.find(id => !state.done.includes(id));

function pinStatus(pin) {
  if (freeMode()) return "open";
  if (!state.unlockedPins.includes(pin.id)) return "locked";
  // chapters(配列)が基本。古い書き方の chapter(1つ)でも動くようにしておく
  const chs = pin.chapters ?? (pin.chapter ? [pin.chapter] : []);
  if (chs.includes(nextChapter())) return "next";
  return chs.length > 0 && chs.every(c => state.done.includes(c)) ? "open" : "locked";
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 2200);
}

function onPin(pin) {
  const status = pinStatus(pin);
  if (status === "locked") return toast("ここにはまだ行けません");
  if (status === "next") return playChapter(nextChapter());
  // クリア後・訪問済み: ストーリーは進めず、解説を表示する
  const spot = $("spot");
  spot.textContent = `${pin.name}:${pin.info}`;
  spot.hidden = false;
  setTimeout(() => { spot.hidden = true; }, 4000);
}

function openMap() {
  show("map");
  $("spot").hidden = true;
  showMap(onPin, pinStatus);
}

/* ---------- AI会話 ---------- */
function say(text) {
  $("chatWho").textContent = characters.kaguya.name;
  $("chatText").textContent = text;
}

function openChat() {
  $("chatTitle").textContent = freeMode() ? "自由会話" : "会話";
  setChara($("chatChara"), "kaguya", true);
  show("chat");
  if (!$("chatText").textContent) {
    say(freeMode() ? "向日市のこと、なんでも話しましょう。" : "こんにちは。何か気になることはありますか?");
  }
}

async function send() {
  const input = $("msg");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  say("……");
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

/* ---------- デバッグ(URLに ?debug=1) ---------- */
if (new URLSearchParams(location.search).has("debug")) {
  $("debug").hidden = false;
  $("debug").onclick = e => {
    const act = e.target.dataset.dbg;
    if (act === "skip") {
      const id = order.find(c => !state.done.includes(c));
      if (id) { markDone(id); if (id === "ed") finishGame(); }
      showHome();
    }
    if (act === "clear") { order.forEach(markDone); finishGame(); showHome(); }
    if (act === "reset") { resetAll(); showTitle(); }
  };
}

showTitle();
