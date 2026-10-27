<<<<<<< HEAD
// ワード探し「平将門の言葉さがし」(kotobaasobi.html を部品にしたもの)
=======
// ワード探し「菅原道真の試練」(kotobaasobi.html を部品にしたもの)
>>>>>>> 4472c297a465cf2022ecc76afdefd6d635757bcd
// start(box, onFinish): box に画面を作り、全部見つけたら onFinish("clear") を呼ぶ。
// 戻り値は、画面を離れるときに呼ぶ後始末の関数。

const SIZE = 8;
const QUESTION_COUNT = 3;

<<<<<<< HEAD
// 平将門に関係する言葉(すべて8文字以内)
const WORD_BANK = [
  "くび", "からだ", "まさかど", "たいら", "ぶし", "ぶげい", "いくさ", "さむらい",
  "かんとう", "しんのう", "きおく", "ことば", "たましい", "むしゃ", "ほこり",
  "つわもの", "かぶと", "よろい", "ゆみや", "やいば"
=======
// 菅原道真・平安時代に関係する言葉(すべて8文字以内)
const WORD_BANK = [
  "すがわら", "みちざね", "へいあん", "へいあんきょう", "だざいふ", "てんまんぐう",
  "きたのてんじん", "うめ", "うめのはな", "わか", "かんし", "がくもん",
  "もんじょうはかせ", "だいがくのかみ", "さだいじん", "うだいじん", "ふじわら",
  "えんぎ", "かんぴょう", "こうし", "きょうと", "みやこ", "ちょうてい", "きぞく",
  "てんのう", "かんじ", "しょもつ", "ふで", "すずり", "しきし", "しきぶ", "れきし",
  "まつり", "おまいり", "じんじゃ", "きねん", "てんじん", "うた", "ことば",
  "しゅうじ", "こうきょ", "せいじ", "やくにん", "しんぶん"
>>>>>>> 4472c297a465cf2022ecc76afdefd6d635757bcd
];

const HIRAGANA =
  "あいうえおかきくけこさしすせそたちつてとなにぬねの" +
  "はひふへほまみむめもやゆよらりるれろわをん";

const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

let previousWordSet = ""; // 前回と同じ出題にならないよう、遊び直しをまたいで覚えておく

export function start(box, onFinish) {
  let board = [];
  let currentWords = [];
  let firstCell = null;
  let foundWords = [];
  let foundCells = [];
  let finishTimer = null;

  box.innerHTML = `
    <div class="ws">
<<<<<<< HEAD
      <h2>平将門の言葉さがし</h2>
      <p class="sub">境内に散らばった、大切な言葉を探し出そう!</p>
=======
      <h2>菅原道真の試練</h2>
      <p class="sub">平安の知識を頼りに、隠された言葉を見つけ出せ!</p>
>>>>>>> 4472c297a465cf2022ecc76afdefd6d635757bcd
      <p class="rules">言葉の最初と最後の文字を、順にタップ。<br>縦・横・斜め、逆向きにも隠れているぞ。</p>
      <div class="ws-words"></div>
      <div class="ws-grid"></div>
      <p class="ws-msg" aria-live="polite"></p>
<<<<<<< HEAD
      <button class="btn ws-reset" type="button">盤面を作り直す</button>
=======
      <button class="btn ws-reset" type="button">新たな試練</button>
>>>>>>> 4472c297a465cf2022ecc76afdefd6d635757bcd
    </div>`;

  const q = sel => box.querySelector(sel);
  const gridEl = q(".ws-grid");
  const wordsEl = q(".ws-words");
  const msgEl = q(".ws-msg");
  const message = t => { msgEl.textContent = t; };
  const randomHiragana = () => HIRAGANA[Math.floor(Math.random() * HIRAGANA.length)];

  /* ----- 出題と盤面づくり ----- */
  function selectRandomWords() {
    const candidates = WORD_BANK.filter(w => Array.from(w).length <= SIZE);
    let selected, selectedSet, attempts = 0;
    do {
      const shuffled = [...candidates];
      for (let i = shuffled.length - 1; i > 0; i--) { // Fisher-Yates
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      selected = shuffled.slice(0, QUESTION_COUNT);
      selectedSet = [...selected].sort().join(",");
      attempts++;
    } while (selectedSet === previousWordSet && attempts < 100);
    currentWords = selected;
    previousWordSet = selectedSet;
  }

  function placeWord(word) {
    const letters = Array.from(word);
    for (let attempt = 0; attempt < 1000; attempt++) {
      const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      const r0 = Math.floor(Math.random() * SIZE);
      const c0 = Math.floor(Math.random() * SIZE);
      const rEnd = r0 + dr * (letters.length - 1);
      const cEnd = c0 + dc * (letters.length - 1);
      if (rEnd < 0 || rEnd >= SIZE || cEnd < 0 || cEnd >= SIZE) continue;

      let canPlace = true;
      for (let i = 0; i < letters.length; i++) {
        const cur = board[r0 + dr * i][c0 + dc * i];
        if (cur !== "" && cur !== letters[i]) { canPlace = false; break; }
      }
      if (!canPlace) continue;

      for (let i = 0; i < letters.length; i++) board[r0 + dr * i][c0 + dc * i] = letters[i];
      return true;
    }
    return false;
  }

  function generateBoard() {
    const sorted = [...currentWords].sort((a, b) => Array.from(b).length - Array.from(a).length);
    for (let attempt = 0; attempt < 100; attempt++) {
      board = Array.from({ length: SIZE }, () => Array(SIZE).fill(""));
      if (sorted.every(placeWord)) break;
    }
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++)
        if (board[r][c] === "") board[r][c] = randomHiragana();
  }

  /* ----- 表示 ----- */
  function createGrid() {
    gridEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "ws-cell";
        cell.textContent = board[r][c];
        cell.dataset.row = r;
        cell.dataset.col = c;
        gridEl.appendChild(cell);
      }
    }
    updateCellColors();
  }

  function createWordList() {
    wordsEl.innerHTML = "";
    currentWords.forEach(word => {
      const el = document.createElement("span");
      el.className = "ws-word" + (foundWords.includes(word) ? " done" : "");
      el.textContent = word;
      wordsEl.appendChild(el);
    });
  }

  function updateCellColors() {
    gridEl.querySelectorAll(".ws-cell").forEach(cell => {
      const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
      cell.classList.toggle("found", foundCells.some(p => p.row === r && p.col === c));
      cell.classList.toggle("selected", !!firstCell && firstCell.row === r && firstCell.col === c);
    });
  }

  /* ----- 操作と判定 ----- */
  function selectCell(row, col) {
    if (foundWords.length === currentWords.length) return;

    if (firstCell === null) {
      firstCell = { row, col };
      message("言葉の最後の文字をタップしてください。");
    } else if (firstCell.row === row && firstCell.col === col) {
      firstCell = null; // 同じマスをもう一度タップ → 選び直し
      message("選び直してください。");
    } else {
      const start = firstCell;
      firstCell = null;
      checkWord(start, { row, col });
    }
    updateCellColors();
  }

  function checkWord(start, end) {
    const rowDiff = end.row - start.row;
    const colDiff = end.col - start.col;

    if (rowDiff !== 0 && colDiff !== 0 && Math.abs(rowDiff) !== Math.abs(colDiff)) {
      return message("縦・横・斜めの直線を選んでください。");
    }

    const rowStep = Math.sign(rowDiff);
    const colStep = Math.sign(colDiff);
    const length = Math.max(Math.abs(rowDiff), Math.abs(colDiff)) + 1;

    let selectedWord = "";
    const selectedCells = [];
    for (let i = 0; i < length; i++) {
      const row = start.row + rowStep * i;
      const col = start.col + colStep * i;
      selectedWord += board[row][col];
      selectedCells.push({ row, col });
    }
    const reversed = Array.from(selectedWord).reverse().join("");
    const answer = currentWords.find(w => w === selectedWord || w === reversed);

    if (answer && !foundWords.includes(answer)) {
      foundWords.push(answer);
      foundCells.push(...selectedCells);
      createWordList();
      if (foundWords.length === currentWords.length) {
<<<<<<< HEAD
        message("すべての言葉を見つけた!将門の記憶が戻っていく……");
=======
        message("見事!菅原道真の試練を突破しました!");
>>>>>>> 4472c297a465cf2022ecc76afdefd6d635757bcd
        finishTimer = setTimeout(() => onFinish("clear"), 1400); // 結果を少し見せてから次へ
      } else {
        message("正解!「" + answer + "」を見つけました!");
      }
    } else if (answer) {
      message("「" + answer + "」はすでに見つけています。");
    } else {
      message("不正解です。別の言葉を探してください。");
    }
  }

  function reset() {
    clearTimeout(finishTimer);
    firstCell = null;
    foundWords = [];
    foundCells = [];
    selectRandomWords();
    generateBoard();
    createGrid();
    createWordList();
<<<<<<< HEAD
    message("散らばった言葉を探し出そう!");
=======
    message("菅原道真の試練が始まった!言葉を探せ!");
>>>>>>> 4472c297a465cf2022ecc76afdefd6d635757bcd
  }

  gridEl.onclick = e => {
    const cell = e.target.closest(".ws-cell");
    if (cell) selectCell(Number(cell.dataset.row), Number(cell.dataset.col));
  };
  q(".ws-reset").onclick = reset;

  reset();

  return () => { clearTimeout(finishTimer); box.innerHTML = ""; };
}
