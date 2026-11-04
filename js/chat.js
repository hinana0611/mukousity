// AI会話の窓口。main.js からは initChat と sendMessage だけを使う。
//   initChat(onStatus) … 知識ファイルとAIモデルを読み込む(1回だけ。進み具合を onStatus(文字) で知らせる)
//   sendMessage(text, mode) … かぐやの返事(文字)を返す
//
// 向日市ガイドAI: ブラウザの中で動くAI(WebLLM)に、質問に合わせて知識テキストを渡して答えさせる。
//   ・サーバーもAPIキーもいらない(AIはスマホ/パソコンの中で動く)
//   ・初回はモデル(約1GB)のダウンロードで数分かかる。2回目からはブラウザに保存されて速い
//   ・WebGPU に対応したブラウザが必要。使えないときは「かんたんモード」(決まった返事)になる

const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm";
const KNOWLEDGE_DIR = "knowledge";
const MAX_HISTORY = 8; // 覚えておく会話の数(質問と返事を1つずつで2)。多いとAIが重く・混乱しやすい

// 知識ファイルを探す場所(上から順に探す)。フォルダ分けしていても、全部まとめて置いていても動く
const SEARCH_DIRS = [`${KNOWLEDGE_DIR}/`, `${KNOWLEDGE_DIR}/kofun/`, `${KNOWLEDGE_DIR}/nagaokakyo/`, ""];
const RULE_DIRS = ["", `${KNOWLEDGE_DIR}/`]; // system_rule.txt は index.html と同じ場所が先

// 物集女車塚古墳のファイル名は、2通りの書き方に対応
const KURUMAZUKA = ["motosume_kurumazuka.txt", "mozumekurumaduka_kofun.txt"];

// 質問に含まれる言葉 → 一緒に渡す知識ファイル(配列の中は「どれか1つ見つかれば良い」別名)
const RULES = [
  { re: /神社|向日神社|お参り/, files: ["shrine.txt"] },
  { re: /竹|竹の径|かぐや姫|竹取物語/, files: ["takenomichi.txt"] },
  { re: /城|物集女城/, files: ["mozumejo.txt"] },
  { re: /資料館|向日市資料館/, files: ["museum.txt"] },
  { re: /天文館|星|宇宙|向日市天文館/, files: ["astoromy.txt"] },
  { re: /グルメ|ご飯|ランチ|食べる|食べ物|ラーメン|激辛|お酒|カフェ|スイーツ|パン/, files: ["gulme_mukou.txt"] },
  { re: /BMX|自転車|サイクルパーク|競輪場|パーク/, files: ["ciclpark.txt"] },
  { re: /古墳|前方後円墳/, files: ["terado_otsuka.txt", KURUMAZUKA] },
  { re: /寺戸大塚/, files: ["terado_otsuka.txt"] },
  { re: /物集女車塚/, files: [KURUMAZUKA] },
  { re: /長岡京|長岡宮|都|桓武天皇/, files: ["overview.txt", "daigokuden.txt", "choudoin.txt", "higaiin.txt"] },
  { re: /大極殿/, files: ["daigokuden.txt"] },
  { re: /朝堂院/, files: ["choudoin.txt"] },
  { re: /東院公園/, files: ["higaiin.txt"] },
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
  for (const f of wanted) extra += "\n\n" + (await loadAny(f));
  return extra;
}

/* ----- 初期化 ----- */
const simple = notice => ({ ai: false, notice });

async function doInit() {
  try {
    const noGpu = simple("このブラウザはAI会話(WebGPU)に対応していないので、かんたんモードでおしゃべりしますね。");
    if (!navigator.gpu) return noGpu;
    // 入り口はあっても、使えるGPUがない端末では、大きなダウンロードを始める前に切り替える
    if (navigator.gpu.requestAdapter && !(await navigator.gpu.requestAdapter())) return noGpu;

    statusCb("知識ファイルを読み込み中……");
    const rule = await loadAny("system_rule.txt", RULE_DIRS);
    const summary = await loadAny("summary.txt");
    if (!rule) return simple("知識ファイル(system_rule.txt)が見つからなかったので、かんたんモードでおしゃべりしますね。");
    baseSystemPrompt = `${rule}\n\n【概要・参考情報】\n${summary}`;

    statusCb("AIモデルを読み込み中……(初回は数分かかります)");
    const webllm = await import(WEBLLM_URL);
    engine = await webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: p => statusCb(`AI準備中: ${Math.round(p.progress * 100)}%`)
    });
    return { ai: true, notice: "" };
  } catch (err) {
    console.error(err);
    engine = null;
    return simple("AIを読み込めなかったので、かんたんモードでおしゃべりしますね。");
  }
}

// 戻り値: { ai: true/false, notice: 「かんたんモード」のときの説明 }。失敗してもエラーにはならない
export function initChat(onStatus = () => {}) {
  statusCb = onStatus;
  if (!initPromise) initPromise = doInit();
  return initPromise;
}

/* ----- 返事 ----- */
// かんたんモード用の決まった返事
const dummy = {
  story: ["いまは物語の途中ですね。マップのピンを押して先へ進みましょう。", "ゆっくりで大丈夫です。気になることがあれば聞いてくださいね。"],
  free: ["向日市のことなら何でも聞いてくださいね。", "気になる場所があれば、マップから訪ねてみましょう。"]
};
let n = 0;

// mode: "story"(物語の途中) / "free"(クリア後)
export async function sendMessage(text, mode = "story") {
  if (initPromise) await initPromise;
  if (!engine) {
    await new Promise(r => setTimeout(r, 400));
    const list = dummy[mode] || dummy.story;
    return list[n++ % list.length];
  }

  const extra = await getDynamicKnowledge(text);
  const messages = [
    { role: "system", content: baseSystemPrompt + extra },
    ...history,
    { role: "user", content: text }
  ];
  const reply = await engine.chat.completions.create({
    messages,
    temperature: 0.3, // 低いほど、知識ファイルに書いてあることから外れにくい
    max_tokens: 300
  });
  const answer = reply.choices[0].message.content;

  history.push({ role: "user", content: text }, { role: "assistant", content: answer });
  while (history.length > MAX_HISTORY) history.splice(0, 2);
  return answer;
}
