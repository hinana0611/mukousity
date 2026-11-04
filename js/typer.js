// 文字を左から1文字ずつ表示する仕組み(会話の枠・AI会話の枠で共通)
//   ・枠(box)の大きさは固定。文が長くて枠に入りきらないときは、何ページかに分ける
//   ・行の折り返しは、言葉のきりがいいところ(文節)で。言葉のとちゅうでは改行しない(phrase() を参照)
//   ・タップ(tap())したとき:
//       文字を出している途中 → そのページを最後まで一気に出す
//       続きのページがある   → 次のページを、また最初から1文字ずつ出す
//       全部読み終わっている → false を返す(会話なら次のセリフへ進む、など呼ぶ側が決める)
//
// 使い方:
//   const t = createTyper({ box, textEl, moreEl });
//   t.set("長い文章……");          … 1文字ずつ表示を始める
//   t.set("準備中 50%", { instant: true }); … すぐ全部出す(1文字ずつにしない)
//   if (!t.tap()) { 次へ進む }

const SPEED = 35; // 1文字を出す間隔(ミリ秒)。小さいほど速い
const ZWSP = "​"; // 目に見えない「ここで改行してよい」しるし
const WJ = "⁠";   // 目に見えない「ここでは改行しない」しるし(ブラウザが勝手に改行するところを止める)
const INVISIBLE = [ZWSP, WJ];
const SENTENCE_BREAKS = "。！？!?…」』）\n"; // ページを分けるとき、まずはここ(文の終わり)で切る
const PHRASE_BREAKS = "、" + ZWSP;           // それがなければ、ここ(言葉の区切り)で切る

// 動きを減らす設定の人には、1文字ずつにせず、すぐ全部出す
const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/* ----- 言葉のきりがいいところ(文節)に、改行してよいしるしを入れる -----
   日本語は「ひらがな(てにをは) → 漢字・カタカナ」に変わるところが、だいたい言葉の区切り。
     例: 月から|100年ぶりの|定期点検に|降りてきたのですが、|すっかり|街並みが|変わってしまって……
   CSS の word-break: keep-all で、しるし以外のところでは改行しないようにしている */
const KIND = ch =>
  /[ぁ-ゟ]/.test(ch) ? "hira" :
  /[一-鿿㐀-䶿々〆]/.test(ch) ? "kanji" :
  /[゠-ヿｦ-ﾟ]/.test(ch) ? "kata" :
  /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/.test(ch) ? "alnum" : "other";
const ALWAYS_AFTER = /[、。，．！？!?]/;                 // このあとは、いつでも区切ってよい
const CLOSE = /[」』）)】〉》]/;                          // とじかっこ(あとに「は」などが続くときは、くっつける)
const OPEN = /[「『（(【〈《]/;                           // ひらきかっこの前で区切る
const NO_BREAK_BEFORE = /[、。，．！？!?」』）)】〉》…‥ーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ々・：:]/; // 行のはじめに来てはいけない文字
const PREFIX = /[おご]/; // 「お尋ね」「ご案内」の「お」「ご」は、うしろの漢字とくっつける
const PARTICLE = /[はがをにでとへもやの]/; // 1文字の「てにをは」
const DASH = /[―—–]/;

export function phrase(text) {
  const cs = Array.from(String(text ?? "").replaceAll(ZWSP, "").replaceAll(WJ, ""));
  let out = "";
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], n = cs[i + 1];
    out += c;
    if (!n || /\s/.test(c) || /\s/.test(n)) continue;
    const kc = KIND(c), kn = KIND(n);
    // 「』へは」「）があれば」: とじかっこと、うしろの「てにをは」は離さない / 「――」も前の文字から離さない
    if ((CLOSE.test(c) && kn === "hira") || (DASH.test(n) && !DASH.test(c))) { out += WJ; continue; }
    if (NO_BREAK_BEFORE.test(n)) continue;
    // 「溢れ出す」「閉じ込める」: 漢字 + ひらがな1文字 + 漢字 は、ひとつの言葉としてくっつける
    // (「点検に降りる」の「に」のような、てにをはのときは区切る)
    const kp = KIND(cs[i - 1] ?? "");
    const okurigana = kc === "hira" && kn === "kanji" && kp === "kanji" && !PARTICLE.test(c);
    const noKo = c === "の" && n === "子"; // 「女の子」「男の子」
    const brk =
      ALWAYS_AFTER.test(c) ||
      (c === "…" && n !== "…") ||
      (CLOSE.test(c) && kn !== "hira") ||
      OPEN.test(n) ||
      (kc === "hira" && (kn === "kanji" || kn === "kata" || kn === "alnum") && !(PREFIX.test(c) && kn === "kanji") && !okurigana && !noKo);
    if (brk) out += ZWSP;
  }
  return out;
}

export function createTyper({ box, textEl, moreEl }) {
  let pages = [""];
  let page = 0;
  let timer = null;
  let fullText = "";

  // 文字を1つずつに分ける(絵文字なども1文字として数える)
  const chars = s => Array.from(s);

  // text を、枠に入りきる長さごとに分ける
  function paginate(text) {
    // 画面に出ていない(大きさが0の)ときは、測れないので1ページのまま
    if (!box.clientHeight) return [text];
    const fits = s => {
      textEl.textContent = s;
      return box.scrollHeight <= box.clientHeight + 1;
    };
    const result = [];
    let rest = chars(text);
    while (rest.length) {
      if (fits(rest.join(""))) { result.push(rest.join("")); break; }
      // 入りきる一番長い長さを、半分ずつ絞って探す
      let lo = 1, hi = rest.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(rest.slice(0, mid).join(""))) lo = mid;
        else hi = mid - 1;
      }
      // ページの後ろ半分に、文の終わりがあればそこで、なければ言葉の区切りで切る
      const findCut = marks => {
        for (let i = lo - 1; i >= Math.floor(lo / 2); i--) if (marks.includes(rest[i])) return i + 1;
        return 0;
      };
      const cut = findCut(SENTENCE_BREAKS) || findCut(PHRASE_BREAKS) || lo;
      result.push(rest.slice(0, cut).join("").replace(/[\n​⁠]+$/, ""));
      rest = chars(rest.slice(cut).join("").replace(/^[\s　​⁠]+/, ""));
    }
    textEl.textContent = "";
    return result.length ? result : [""];
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  // いまのページを、最後まで全部出す
  function finishPage() {
    stop();
    textEl.textContent = pages[page];
    if (moreEl) moreEl.hidden = false;
    if (moreEl) moreEl.classList.toggle("more", page < pages.length - 1); // 続きがあるときは表示を変える
  }

  // まだ出していない文字も、見えない形で置いておく(行の折り返しが、とちゅうで変わらないように)
  const rest = document.createElement("span");
  rest.className = "typerRest";
  const shownNode = document.createTextNode("");

  function typePage() {
    stop();
    if (moreEl) moreEl.hidden = true;
    const list = chars(pages[page]);
    if (reduceMotion() || !list.length) return finishPage();
    let shown = 0;
    const show = () => {
      shownNode.data = list.slice(0, shown).join("");
      rest.textContent = list.slice(shown).join("");
    };
    show();
    textEl.replaceChildren(shownNode, rest);
    timer = setInterval(() => {
      shown++;
      while (shown < list.length && INVISIBLE.includes(list[shown - 1])) shown++; // しるしは見えないので、待たずに進む
      show();
      if (shown >= list.length) finishPage();
    }, SPEED);
  }

  return {
    // phrase: false なら、言葉の区切りのしるしを入れない(英語の文など)
    set(text, { instant = false, phrase: usePhrase = true } = {}) {
      fullText = String(text ?? "");
      stop();
      pages = paginate(usePhrase ? phrase(fullText) : fullText);
      page = 0;
      if (instant) finishPage();
      else typePage();
    },
    // 枠の大きさが変わったとき(画面を開き直したときなど)に、いまの文章を分け直す
    refresh() {
      this.set(fullText, { instant: true });
    },
    tap() {
      if (timer) { finishPage(); return true; }
      if (page < pages.length - 1) { page++; typePage(); return true; }
      return false;
    },
    stop,
    get text() { return fullText; }
  };
}
