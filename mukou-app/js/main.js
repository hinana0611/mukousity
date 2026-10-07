import { state, progress, markDone, finishGame, restartStory, resetAll } from "./state.js";
import { characters, chapters, pinOrder } from "./story.js";
import { showMap } from "./map.js";
import { sendMessage } from "./chat.js";
 
const $ = id => document.getElementById(id);
const order = ["prologue", "tutorial", ...pinOrder, "boss", "ed"];
 
// クリア後モード = EDまで終えている状態(「はじめから」でやり直すと通常モードに戻る)
const freeMode = () => state.cleared && state.done.includes("ed");
 
/* ---------- 画面切り替え ---------- */
function show(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("on", s.id === name));
  $("menu").hidden = true;
}
 
function setChara(el, key, speaking) {
  const c = characters[key];
  el.textContent = c && !c.image ? c.initial : "";
  el.style.backgroundImage = c && c.image ? `url(${c.image})` : "";
  el.classList.toggle("speak", !!speaking);
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
  // 会話で進む章(途中でやめた場合も、その章の頭から再開)
  if (["prologue", "tutorial", "boss", "ed"].includes(next)) return playChapter(next);
  showHome(); // マップのピンで進める章は、ホームから
};
 
$("restart").onclick = () => {
  if (!confirm("はじめからやり直します。いまの進捗はリセットされます。よろしいですか?")) return;
  restartStory();
  playChapter("prologue");
};
 
/* ---------- 会話(プロローグ・チュートリアル・ボス・ED共通) ---------- */
function playChapter(id) {
  const ch = chapters[id];
  const speakers = [...new Set(ch.lines.map(l => l[0]))];
  let i = 0;
  $("dialogStage").classList.toggle("stagger", id === "tutorial" || id === "boss");
 
  const render = () => {
    const [who, text] = ch.lines[i];
    setChara($("charaL"), speakers[0], who === speakers[0]);
    setChara($("charaR"), speakers[1], who === speakers[1]);
    $("who").textContent = characters[who].name;
    $("text").textContent = text;
  };
 
  $("textbox").onclick = () => {
    if (++i < ch.lines.length) return render();
    markDone(id);
    if (ch.next === "home") showHome();
    else if (ch.next === "end") { finishGame(); showHome(); }
    else playChapter(ch.next);
  };
 
  show("dialog");
  render();
}
 
/* ---------- ホーム ---------- */
function showHome() {
  const p = progress();
  $("barFill").style.width = p + "%";
  $("barText").textContent = p + "%";
  setChara($("homeChara"), "kaguya", true);
  show("home");
}
 
$("menuBtn").onclick = () => { $("menu").hidden = !$("menu").hidden; };
 
document.addEventListener("click", e => {
  const go = e.target.closest("[data-go]")?.dataset.go;
  if (go === "home") showHome();
  if (go === "map") openMap();
  if (go === "chat") openChat();
});
 
/* ---------- マップ ---------- */
const nextChapter = () => pinOrder.find(id => !state.done.includes(id));
 
function pinStatus(pin) {
  if (freeMode()) return "open";
  if (!state.unlockedPins.includes(pin.id) || !pin.chapter) return "locked";
  if (state.done.includes(pin.chapter)) return "open";
  return pin.chapter === nextChapter() ? "next" : "locked";
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
  if (status === "next") return playChapter(pin.chapter);
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