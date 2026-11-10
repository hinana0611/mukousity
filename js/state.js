// ゲームの状態を一か所で管理し、localStorage に保存する
import { chapterOrder } from "./story.js";

const KEY = "mukou-game";
const validIds = ["prologue", ...chapterOrder, "ed"]; // 有効な章のid
export const TOTAL = 7; // 章の数(story.js の chapters と合わせる)

const initial = {
  done: [],                                  // クリアした章のid
  cleared: false,                            // 一度でもクリアしたか
  seen: [],                                  // 最後まで見た会話の場面("sawara1:lines" など)。2回目からスキップできる
  unlockedPins: ["nagaokakyu", "mukojinja", "chiyozakura", "takenomichi"]
};

export const state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) ?? {};
    const base = structuredClone(initial);
    return {
      cleared: !!saved.cleared,
      // 見た場面も、いまは存在しない章のものは捨てる
      // (seen がない古い保存データでは、終えた章の会話は「見た」ことにする)
      seen: Array.isArray(saved.seen)
        ? saved.seen.filter(s => typeof s === "string" && validIds.includes(s.split(":")[0]))
        : (Array.isArray(saved.done) ? saved.done.filter(id => validIds.includes(id)).flatMap(id => [id + ":lines", id + ":after"]) : base.seen),
      // 前のバージョンで保存された、いまは存在しない章のidは捨てる
      done: Array.isArray(saved.done) ? saved.done.filter(id => validIds.includes(id)) : base.done,
      // 行けるピンは保存せず、いつも最新の設定を使う(古い保存データに引きずられないように)
      unlockedPins: base.unlockedPins
    };
  } catch {
    return structuredClone(initial);
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export const progress = () => Math.round((state.done.length / TOTAL) * 100);

export function markDone(id) {
  if (!state.done.includes(id)) state.done.push(id);
  save();
}

// 会話の場面を最後まで見たとき(scene は "prologue:lines" など)
export function markSeen(scene) {
  if (!state.seen.includes(scene)) state.seen.push(scene);
  save();
}

// EDに着いたとき
export function finishGame() {
  state.cleared = true;
  save();
}

// ストーリーだけやり直す(cleared と、見た場面 seen は残す)
export function restartStory() {
  state.done = [];
  save();
}

export function resetAll() {
  Object.assign(state, structuredClone(initial));
  save();
}
