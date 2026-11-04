// AI会話の窓口。main.js からは initChat と sendMessage だけを使う。
//   initChat(onStatus) … 知識ファイルとAIモデルを読み込む(1回だけ。進み具合を onStatus(文字) で知らせる)
//   sendMessage(text, mode) … かぐやの返事(文字)を返す
//
// 向日市ガイドAI: ブラウザの中で動くAI(WebLLM)に、質問に合わせて知識テキストを渡して答えさせる。
//   ・サーバーもAPIキーもいらない(AIはスマホ/パソコンの中で動く)
//   ・初回はモデル(約1GB)のダウンロードで数分かかる。2回目からはブラウザに保存されて速い
//   ・WebGPU に対応したブラウザが必要。使えないときは「かんたんモード」(決まった返事)になる

const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
// もっと軽く・速くしたいときは、上の行をやめて下の行を使う(ダウンロードは約1GB → 約0.4GB)。
// そのかわり賢さは下がり、知識ファイルに書いていないことを答えやすくなる。
// const MODEL_ID = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";
const KNOWLEDGE_DIR = "knowledge";
const MAX_HISTORY = 8; // 覚えておく会話の数(質問と返事を1つずつで2)。多いとAIが重く・混乱しやすい

// 知識ファイルを探す場所(上から順に探す)。フォルダ分けしていても、全部まとめて置いていても動く
const SEARCH_DIRS = [`${KNOWLEDGE_DIR}/`, `${KNOWLEDGE_DIR}/kofun/`, `${KNOWLEDGE_DIR}/nagaokakyo/`, ""];
const RULE_DIRS = ["", `${KNOWLEDGE_DIR}/`]; // system_rule.txt は index.html と同じ場所が先

// 物集女車塚古墳のファイル名は、2通りの書き方に対応
const KURUMAZUKA = ["motosume_kurumazuka.txt", "mozumekurumaduka_kofun.txt"];

// 一緒に渡す知識の、文字数の上限。多すぎるとAIが一度に読める量(約4000トークン)を超えて、返事ができなくなる
const MAX_EXTRA_CHARS = 1800;

// 質問に含まれる言葉 → 一緒に渡す知識ファイル(配列の中は「どれか1つ見つかれば良い」別名)
// 上限があるので、くわしい言葉(大極殿など)を先に、広い言葉(長岡京など)をあとに書く
const RULES = [
  { re: /大極殿/, files: ["daigokuden.txt"] },
  { re: /朝堂院/, files: ["choudoin.txt"] },
  { re: /東院公園/, files: ["higaiin.txt"] },
  { re: /寺戸大塚/, files: ["terado_otsuka.txt"] },
  { re: /物集女車塚/, files: [KURUMAZUKA] },
  { re: /神社|向日神社|お参り/, files: ["shrine.txt"] },
  { re: /竹|竹の径|かぐや姫|竹取物語/, files: ["takenomichi.txt"] },
  { re: /城|物集女城/, files: ["mozumejo.txt"] },
  { re: /資料館|向日市資料館/, files: ["museum.txt"] },
  { re: /天文館|星|宇宙|向日市天文館/, files: ["astoromy.txt"] },
  { re: /グルメ|ご飯|ランチ|食べる|食べ物|ラーメン|激辛|お酒|カフェ|スイーツ|パン/, files: ["gulme_mukou.txt"] },
  { re: /BMX|自転車|サイクルパーク|競輪場|パーク/, files: ["ciclpark.txt"] },
  { re: /古墳|前方後円墳/, files: ["terado_otsuka.txt", KURUMAZUKA] },
  // 「都」1文字だと「京都」「都合」にも反応してしまうので、「遷都」「都の跡」などに絞る
  { re: /長岡京|長岡宮|遷都|都の跡|昔の都|桓武天皇/, files: ["overview.txt", "daigokuden.txt", "choudoin.txt", "higaiin.txt"] },
  { re: /歴史|伝説|由来/, files: ["history.txt"] }
];

let engine = null;
let baseSystemPrompt = "";
let initPromise = null;
let statusCb = () => {};
const history = [];
const fileCache = new Map();

/* ----- 知識ファイルの読み込み ----- */
async function fetchText(path) {
  try {
    const res = await fetch(path);
    return res.ok ? await res.text() : "";
  } catch {
    return "";
  }
}

// names のうち最初に見つかったものを返す(なければ "")
async function loadAny(names, dirs = SEARCH_DIRS) {
  const list = Array.isArray(names) ? names : [names];
  const key = list.join("|") + "@" + dirs.join("|");
  if (fileCache.has(key)) return fileCache.get(key);
  let text = "";
  search: for (const name of list) {
    for (const dir of dirs) {
      text = await fetchText(dir + name);
      if (text) break search;
    }
  }
  fileCache.set(key, text);
  return text;
}

// 質問に合わせた知識を集める(同じファイルは1回だけ)
async function getDynamicKnowledge(userInput) {
  const wanted = [];
  for (const rule of RULES) {
    if (!rule.re.test(userInput)) continue;
    for (const f of rule.files) if (!wanted.some(w => String(w) === String(f))) wanted.push(f);
  }
  let extra = "";
  for (const f of wanted) {
    const text = await loadAny(f);
    // 上限を超えるファイルは渡さない(ただし1つ目は、長くても必ず渡す)
    if (extra && extra.length + text.length > MAX_EXTRA_CHARS) continue;
    extra += "\n\n" + text;
  }
  return extra;
}

/* ----- 初期化 ----- */
const simple = notice => ({ ai: false, notice });

// AI本体を作る。別スレッド(Worker)で動かすと、読み込み中もゲームや画面が固まりにくい
async function createEngine(webllm) {
  const opts = { initProgressCallback: p => statusCb(`AI準備中: ${Math.round(p.progress * 100)}%`) };
  try {
    const worker = new Worker(new URL("./chat-worker.js?v=" + (window.APP_VERSION ?? ""), import.meta.url), { type: "module" });
    const workerFailed = new Promise((_, reject) =>
      worker.addEventListener("error", e => reject(new Error("worker error: " + e.message))));
    return await Promise.race([webllm.CreateWebWorkerMLCEngine(worker, MODEL_ID, opts), workerFailed]);
  } catch (err) {
    console.warn("Workerで動かせなかったので、画面の中で動かします", err);
    return await webllm.CreateMLCEngine(MODEL_ID, opts);
  }
}

async function doInit() {
  try {
    const noGpu = simple("このブラウザはAI会話(WebGPU)に対応していないので、かんたんモードでおしゃべりしますね。");
    if (!navigator.gpu) return noGpu;
    // 入り口はあっても、使えるGPUがない端末では、大きなダウンロードを始める前に切り替える
    if (navigator.gpu.requestAdapter && !(await navigator.gpu.requestAdapter())) return noGpu;

    // 保存したモデルを、ブラウザが勝手に消さないように頼む(2回目からの読み込みが速くなる)
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    statusCb("読み込み中……");
    // AIの部品の取り寄せと、知識ファイルの読み込みを、同時に始める
    const webllmReady = import(WEBLLM_URL);
    webllmReady.catch(() => {}); // 先に失敗しても、あとで受け取るまで警告を出さない
    const [rule, summary] = await Promise.all([loadAny("system_rule.txt", RULE_DIRS), loadAny("summary.txt")]);
    if (!rule) return simple("知識ファイル(system_rule.txt)が見つからなかったので、かんたんモードでおしゃべりしますね。");
    baseSystemPrompt = `${rule}\n\n【概要・参考情報】\n${summary}`;

    statusCb("AIモデルを読み込み中……(初回は数分かかります)");
    engine = await createEngine(await webllmReady);

    // 最初の返事が遅くならないよう、短い質問で1回だけ試運転しておく
    statusCb("最後の準備中……");
    try {
      await engine.chat.completions.create({
        messages: [{ role: "system", content: "返事は1文字だけ。" }, { role: "user", content: "あ" }],
        max_tokens: 1
      });
    } catch {}
    return { ai: true, notice: "" };
  } catch (err) {
    console.error(err);
    engine = null;
    return simple("AIを読み込めなかったので、かんたんモードでおしゃべりしますね。");
  }
}

// useAI: false なら、ダウンロードせずに「かんたんモード」にする
// 戻り値: { ai: true/false, notice: 「かんたんモード」のときの説明 }。失敗してもエラーにはならない
export function initChat(onStatus = () => {}, useAI = true) {
  statusCb = onStatus;
  if (!initPromise) {
    initPromise = useAI ? doInit() : Promise.resolve(simple("今日はかんたんモードでおしゃべりしますね。"));
  }
  return initPromise;
}

// 会話の記録を消す(「はじめから」のときや、物語の途中 ⇔ クリア後が切り替わったとき)
export function resetChat() {
  history.length = 0;
}

/* ----- 返事 ----- */
// かんたんモード用の決まった返事
const dummy = {
  story: ["いまは物語の途中ですね。マップのピンを押して先へ進みましょう。", "ゆっくりで大丈夫です。気になることがあれば聞いてくださいね。"],
  free: ["向日市のことなら何でも聞いてくださいね。", "気になる場所があれば、マップから訪ねてみましょう。"]
};
let n = 0;
let lastMode = null;

const MAX_REPLY_CHARS = 150; // 返事の長さの上限(文字数)。画面の枠に収まりやすい長さ
const REPLY_RULE = `

【返事の書き方(必ず守る)】
・かぐやの話し言葉で、2〜3文、${MAX_REPLY_CHARS}文字以内で短く答える。
・箇条書き、番号付きのリスト、**太字**、# 見出しは使わない。
・たくさんある場合は、いちばんのおすすめを1〜2個だけ紹介する。`;

// AIの返事を、画面で読みやすい形に整える
//   ・**太字** や # 見出し、「1.」「・」などのリストの記号を外す
//   ・長すぎるとき(途中で切れたときも)は、文の終わり(。!?)で切る
function tidy(text) {
  let t = String(text ?? "")
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*#+\s*/gm, "")
    .replace(/^\s*(?:[-*・]|\d+[.)．])\s*/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (t.length > MAX_REPLY_CHARS) {
    const head = t.slice(0, MAX_REPLY_CHARS);
    const cut = Math.max(...["。", "！", "？", "!", "?"].map(c => head.lastIndexOf(c)));
    t = cut > 20 ? head.slice(0, cut + 1) : head + "……";
  }
  return t;
}

// mode: "story"(物語の途中) / "free"(クリア後)
export async function sendMessage(text, mode = "story") {
  if (initPromise) await initPromise;
  if (mode !== lastMode) { resetChat(); lastMode = mode; } // 話のモードが変わったら、前の会話は忘れる
  if (!engine) {
    await new Promise(r => setTimeout(r, 400));
    const list = dummy[mode] || dummy.story;
    return list[n++ % list.length];
  }

  const extra = await getDynamicKnowledge(text);
  const messages = [
    // 小さなAIは、最後に書いたことほど守りやすいので、短く答えるルールを最後にもう一度書く
    { role: "system", content: baseSystemPrompt + extra + REPLY_RULE },
    ...history,
    { role: "user", content: text }
  ];
  let reply;
  try {
    reply = await engine.chat.completions.create({
      messages,
      temperature: 0.3, // 低いほど、知識ファイルに書いてあることから外れにくい
      max_tokens: 160 // 長すぎる返事にならないように(途中で切れたぶんは tidy() で整える)
    });
  } catch (err) {
    resetChat(); // 長くなりすぎた会話が原因のこともあるので、記録を消して次に備える
    throw err;
  }
  const answer = tidy(reply.choices[0].message.content);

  history.push({ role: "user", content: text }, { role: "assistant", content: answer });
  while (history.length > MAX_HISTORY) history.splice(0, 2);
  return answer;
}
