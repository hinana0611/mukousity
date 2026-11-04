// AIを別スレッド(Worker)で動かすための、小さなファイル。chat.js が自動で読み込む。
// 画面を動かす部分と分けておくと、AIの読み込み・返事の最中も、ゲームや画面が固まりにくい。
import { WebWorkerMLCEngineHandler } from "https://esm.run/@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = msg => handler.onmessage(msg);
