// ゲームの状態を一か所で管理し、localStorage に保存する
const KEY = "mukou-game";
export const TOTAL = 6; // 章の数(story.js の chapters と合わせる)

const initial = {
  done: [],                                  // クリアした章のid
  cleared: false,                            // 一度でもクリアしたか
  unlockedPins: ["nagaokakyu", "shiryokan"]  // 今回は2か所だけ移動できる
};

export const state = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return { ...structuredClone(initial), ...saved };
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

// EDに着いたとき
export function finishGame() {
  state.cleared = true;
  save();
}

// ストーリーだけやり直す(clearedは残す)
export function restartStory() {
  state.done = [];
  save();
}

export function resetAll() {
  Object.assign(state, structuredClone(initial));
  save();
}
