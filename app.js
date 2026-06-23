const BLACK = 1;
const WHITE = 2;
const EMPTY = 0;

const DIRECTIONS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
];

// All lessons share the Rabbit → Rose starting shape.
// The following eight plies are four learner moves and four automatic replies.
const BASE_SEQUENCE = ["f5", "d6", "c3", "d3", "c4", "f4", "c5", "b3"];

const OPENINGS = [
  {
    id: "rose-standard",
    code: "S",
    icon: "基",
    name: "ローズ基本形",
    sub: "Standard / S",
    note: "まず覚える基準のかたち",
    line: ["c2", "e3", "f2", "b5", "g4", "f6", "d2", "e2"],
  },
  {
    id: "rose-flat",
    code: "F",
    icon: "平",
    name: "ローズフラット",
    sub: "Flat / F",
    note: "平たく広がるローズの分岐",
    line: ["d2", "b4", "g3", "g5", "a3", "e1", "e6", "g4"],
  },
  {
    id: "mimura",
    code: "M",
    icon: "三",
    name: "三村流",
    sub: "Mimura",
    note: "中央の形を見分けるルート",
    line: ["e2", "e6", "g4", "b5", "b2", "c2", "b4", "b1"],
  },
  {
    id: "ohwaku",
    code: "O",
    icon: "大",
    name: "大和久流",
    sub: "Ohwaku",
    note: "辺への展開を意識するルート",
    line: ["f3", "f6", "d7", "e6", "b4", "f2", "b2", "c7"],
  },
  {
    id: "inoue",
    code: "I",
    icon: "井",
    name: "井上流",
    sub: "Inoue",
    note: "右辺へ伸びる形を反復",
    line: ["g3", "g6", "f6", "b5", "h7", "h2", "g4", "c6"],
  },
  {
    id: "tezuka",
    code: "T",
    icon: "手",
    name: "手塚システム",
    sub: "Tezuka System",
    note: "システムの入口4手を覚える",
    line: ["g4", "g3", "d7", "e3", "d2", "c2", "f2", "f3"],
  },
];

const els = {
  homeScreen: document.querySelector("#homeScreen"),
  gameScreen: document.querySelector("#gameScreen"),
  openingGrid: document.querySelector("#openingGrid"),
  masteredCount: document.querySelector("#masteredCount"),
  miniBoard: document.querySelector("#miniBoard"),
  board: document.querySelector("#board"),
  homeButton: document.querySelector("#homeButton"),
  backButton: document.querySelector("#backButton"),
  routeCode: document.querySelector("#routeCode"),
  routeName: document.querySelector("#routeName"),
  routeIcon: document.querySelector("#routeIcon"),
  panelRouteName: document.querySelector("#panelRouteName"),
  panelRouteSub: document.querySelector("#panelRouteSub"),
  streakCount: document.querySelector("#streakCount"),
  currentStep: document.querySelector("#currentStep"),
  stepDots: [...document.querySelectorAll("#stepDots span")],
  messageCard: document.querySelector("#messageCard"),
  messageKicker: document.querySelector("#messageKicker"),
  messageTitle: document.querySelector("#messageTitle"),
  messageText: document.querySelector("#messageText"),
  historyList: document.querySelector("#historyList"),
  hintButton: document.querySelector("#hintButton"),
  resetButton: document.querySelector("#resetButton"),
  replayButton: document.querySelector("#replayButton"),
  resultOverlay: document.querySelector("#resultOverlay"),
  resultDialog: document.querySelector(".result-dialog"),
  resultMark: document.querySelector("#resultMark"),
  resultEyebrow: document.querySelector("#resultEyebrow"),
  resultTitle: document.querySelector("#resultTitle"),
  resultText: document.querySelector("#resultText"),
  tryAgainButton: document.querySelector("#tryAgainButton"),
  chooseAnotherButton: document.querySelector("#chooseAnotherButton"),
  installGuide: document.querySelector("#installGuide"),
  installClose: document.querySelector("#installClose"),
};

let board = createInitialBoard();
let activeOpening = null;
let lineIndex = 0;
let learnerStep = 0;
let lastMove = null;
let hintSquare = null;
let locked = false;
let history = [];
let progress = loadProgress();

function createInitialBoard() {
  const next = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
  next[3][3] = WHITE;
  next[3][4] = BLACK;
  next[4][3] = BLACK;
  next[4][4] = WHITE;
  return next;
}

function toPosition(square) {
  return {
    x: square.toLowerCase().charCodeAt(0) - 97,
    y: Number(square[1]) - 1,
  };
}

function toSquare(x, y) {
  return `${String.fromCharCode(97 + x)}${y + 1}`;
}

function inside(x, y) {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

function flipsForMove(square, player) {
  const { x, y } = toPosition(square);
  if (!inside(x, y) || board[y][x] !== EMPTY) return [];

  const opponent = player === BLACK ? WHITE : BLACK;
  const flips = [];

  DIRECTIONS.forEach(([dx, dy]) => {
    const candidates = [];
    let cx = x + dx;
    let cy = y + dy;

    while (inside(cx, cy) && board[cy][cx] === opponent) {
      candidates.push([cx, cy]);
      cx += dx;
      cy += dy;
    }

    if (candidates.length && inside(cx, cy) && board[cy][cx] === player) {
      flips.push(...candidates);
    }
  });

  return flips;
}

function legalMoves(player) {
  const moves = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const square = toSquare(x, y);
      if (flipsForMove(square, player).length) moves.push(square);
    }
  }
  return moves;
}

function playMove(square, player) {
  const flips = flipsForMove(square, player);
  if (!flips.length) return false;

  const { x, y } = toPosition(square);
  board[y][x] = player;
  flips.forEach(([fx, fy]) => {
    board[fy][fx] = player;
  });
  lastMove = square;
  return true;
}

function setupRosePosition() {
  board = createInitialBoard();
  let player = BLACK;
  BASE_SEQUENCE.forEach((move) => {
    playMove(move, player);
    player = player === BLACK ? WHITE : BLACK;
  });
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem("rabbit-opening-progress")) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem("rabbit-opening-progress", JSON.stringify(progress));
}

function renderHome() {
  els.openingGrid.innerHTML = OPENINGS.map((opening) => {
    const clearCount = progress[opening.id] || 0;
    return `
      <button class="opening-card" data-opening="${opening.id}">
        <span class="card-top">
          <span class="card-code">${opening.code}</span>
          <span class="card-state ${clearCount ? "mastered" : ""}">
            ${clearCount ? "● LEARNED" : "○ NOT YET"}
          </span>
        </span>
        <h3>${opening.name}</h3>
        <p>${opening.note}</p>
        <span class="card-bottom">
          <span class="clear-count">CLEAR<br><strong>${clearCount}</strong> TIMES</span>
          <span class="card-arrow">→</span>
        </span>
      </button>
    `;
  }).join("");

  document.querySelectorAll(".opening-card").forEach((card) => {
    card.addEventListener("click", () => {
      startLesson(card.dataset.opening);
    });
  });

  const mastered = OPENINGS.filter((opening) => (progress[opening.id] || 0) > 0).length;
  els.masteredCount.textContent = mastered;
}

function renderMiniBoard() {
  const mini = createInitialBoard();
  // A recognizable abstract rose-like cluster for the landing illustration.
  const pieces = [
    ["c3", BLACK], ["d3", WHITE], ["b3", WHITE], ["c4", BLACK],
    ["d4", BLACK], ["e4", BLACK], ["f4", WHITE], ["c5", BLACK],
    ["d5", BLACK], ["e5", WHITE], ["c6", WHITE], ["d6", WHITE],
  ];
  pieces.forEach(([square, color]) => {
    const { x, y } = toPosition(square);
    mini[y][x] = color;
  });
  els.miniBoard.innerHTML = "";
  mini.forEach((row) => {
    row.forEach((piece) => {
      const cell = document.createElement("span");
      cell.className = "mini-cell";
      if (piece !== EMPTY) {
        cell.innerHTML = `<i class="mini-disc ${piece === BLACK ? "black" : "white"}"></i>`;
      }
      els.miniBoard.appendChild(cell);
    });
  });
}

function showHome() {
  els.resultOverlay.hidden = true;
  els.gameScreen.hidden = true;
  els.homeScreen.hidden = false;
  activeOpening = null;
  renderHome();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startLesson(openingId) {
  activeOpening = OPENINGS.find((opening) => opening.id === openingId);
  if (!activeOpening) return;

  els.homeScreen.hidden = true;
  els.gameScreen.hidden = false;
  els.routeCode.textContent = activeOpening.code;
  els.routeName.textContent = activeOpening.name;
  els.routeIcon.textContent = activeOpening.icon;
  els.panelRouteName.textContent = activeOpening.name;
  els.panelRouteSub.textContent = activeOpening.sub;
  els.streakCount.textContent = progress[activeOpening.id] || 0;
  resetLesson();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetLesson() {
  setupRosePosition();
  lineIndex = 0;
  learnerStep = 0;
  hintSquare = null;
  locked = false;
  history = [];
  lastMove = BASE_SEQUENCE.at(-1);
  els.resultOverlay.hidden = true;
  setMessage(
    "YOUR TURN",
    "黒の最善手は？",
    "ローズの形からスタート。盤面を見て、次の一手を選ぼう。",
  );
  render();
}

function render() {
  renderBoard();
  renderProgress();
  renderHistory();
}

function renderBoard() {
  const valid = !locked ? legalMoves(BLACK) : [];
  els.board.innerHTML = "";

  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const square = toSquare(x, y);
      const piece = board[y][x];
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.dataset.square = square;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", square.toUpperCase());

      if (piece !== EMPTY) {
        cell.innerHTML = `<span class="disc ${piece === BLACK ? "black" : "white"}"></span>`;
      } else if (valid.includes(square)) {
        cell.classList.add("playable");
        cell.addEventListener("click", () => handleLearnerMove(square));
      }

      if (square === lastMove) cell.classList.add("last-move");
      if (square === hintSquare) cell.classList.add("hint");
      els.board.appendChild(cell);
    }
  }
}

function renderProgress() {
  els.currentStep.textContent = Math.min(learnerStep + 1, 4);
  els.stepDots.forEach((dot, index) => {
    dot.className = "";
    if (index < learnerStep) dot.classList.add("done");
    else if (index === learnerStep && learnerStep < 4) dot.classList.add("active");
  });
}

function renderHistory() {
  if (!history.length) {
    els.historyList.innerHTML = `<span class="history-empty">まだ着手はありません</span>`;
    return;
  }

  els.historyList.innerHTML = history.map((item, index) => `
    <span class="history-item">
      ${item.player === BLACK ? "●" : "○"}
      <b>${item.square.toUpperCase()}</b>
      <small>${index + 1}</small>
    </span>
  `).join("");
}

function handleLearnerMove(square) {
  if (locked || !activeOpening) return;
  const expected = activeOpening.line[lineIndex];

  if (square !== expected) {
    locked = true;
    hintSquare = expected;
    setMessage(
      "MISS",
      `${square.toUpperCase()}ではない。`,
      `この形の最善手は ${expected.toUpperCase()}。正しい場所を盤上に表示しました。`,
      "error",
    );
    render();
    window.setTimeout(() => showResult(false, expected), 480);
    return;
  }

  playMove(square, BLACK);
  history.push({ player: BLACK, square });
  learnerStep += 1;
  lineIndex += 1;
  hintSquare = null;
  locked = true;
  setMessage(
    "CORRECT",
    "その一手。",
    learnerStep === 4 ? "4手すべて正解。形がひとつ、身体に入りました。" : "相手の応手を確認して、次の形へ。",
    "success",
  );
  render();

  if (learnerStep === 4) {
    progress[activeOpening.id] = (progress[activeOpening.id] || 0) + 1;
    saveProgress();
    window.setTimeout(() => showResult(true), 650);
    return;
  }

  window.setTimeout(playAutomaticReply, 560);
}

function playAutomaticReply() {
  if (!activeOpening || learnerStep >= 4) return;
  const reply = activeOpening.line[lineIndex];
  playMove(reply, WHITE);
  history.push({ player: WHITE, square: reply });
  lineIndex += 1;
  locked = false;
  setMessage(
    "YOUR TURN",
    "次の最善手は？",
    `白は ${reply.toUpperCase()}。盤面の変化を見て、黒の続きを選ぼう。`,
  );
  render();
}

function setMessage(kicker, title, text, state = "") {
  els.messageKicker.textContent = kicker;
  els.messageTitle.textContent = title;
  els.messageText.textContent = text;
  els.messageCard.className = `message-card ${state}`.trim();
}

function showHint() {
  if (locked || !activeOpening) return;
  hintSquare = activeOpening.line[lineIndex];
  setMessage(
    "HINT",
    `${hintSquare[0].toUpperCase()} の列を見る。`,
    "正解のマスを点線で囲みました。座標と盤面をセットで覚えよう。",
  );
  renderBoard();
}

function showResult(clear, expected = "") {
  els.resultDialog.classList.toggle("is-clear", clear);
  els.resultMark.textContent = clear ? "✓" : "×";
  els.resultEyebrow.textContent = clear ? "LESSON CLEAR" : "GAME OVER";
  els.resultTitle.textContent = clear ? "4手、完全正解。" : "そこで終了。";
  els.resultText.textContent = clear
    ? `${activeOpening.name}を1回習得。忘れる前に、もう一周すると強い。`
    : `正解は ${expected.toUpperCase()}。間違えた形だけ、すぐにもう一度やり直そう。`;
  els.tryAgainButton.textContent = clear ? "もう一周して定着させる" : "同じ定石でもう一度";
  els.resultOverlay.hidden = false;
}

function replaySetup() {
  if (locked || !activeOpening) return;
  locked = true;
  board = createInitialBoard();
  lastMove = null;
  renderBoard();
  let player = BLACK;
  let index = 0;

  const timer = window.setInterval(() => {
    const move = BASE_SEQUENCE[index];
    playMove(move, player);
    renderBoard();
    player = player === BLACK ? WHITE : BLACK;
    index += 1;

    if (index >= BASE_SEQUENCE.length) {
      window.clearInterval(timer);
      window.setTimeout(() => {
        resetLesson();
      }, 450);
    }
  }, 230);
}

els.homeButton.addEventListener("click", showHome);
els.backButton.addEventListener("click", showHome);
els.hintButton.addEventListener("click", showHint);
els.resetButton.addEventListener("click", resetLesson);
els.replayButton.addEventListener("click", replaySetup);
els.tryAgainButton.addEventListener("click", resetLesson);
els.chooseAnotherButton.addEventListener("click", showHome);
els.installClose.addEventListener("click", () => {
  els.installGuide.hidden = true;
  sessionStorage.setItem("install-guide-dismissed", "1");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.resultOverlay.hidden) {
    els.resultOverlay.hidden = true;
  }
});

renderMiniBoard();
renderHome();

const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const guideDismissed = sessionStorage.getItem("install-guide-dismissed") === "1";

document.body.classList.toggle("standalone", isStandalone);
if (isIOS && !isStandalone && !guideDismissed) {
  window.setTimeout(() => {
    els.installGuide.hidden = false;
  }, 800);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // The game still works online if registration is unavailable.
    });
  });
}
