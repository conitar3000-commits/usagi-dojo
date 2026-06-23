const BLACK = 1;
const WHITE = 2;
const EMPTY = 0;
const DRILL_LENGTH = 8;

const DIRECTIONS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

const POSITION_WEIGHTS = [
  [120, -28, 18, 8, 8, 18, -28, 120],
  [-28, -48, -5, -5, -5, -5, -48, -28],
  [18, -5, 12, 3, 3, 12, -5, 18],
  [8, -5, 3, 2, 2, 3, -5, 8],
  [8, -5, 3, 2, 2, 3, -5, 8],
  [18, -5, 12, 3, 3, 12, -5, 18],
  [-28, -48, -5, -5, -5, -5, -48, -28],
  [120, -28, 18, 8, 8, 18, -28, 120],
];

const OPENINGS = [
  { id: "rose-standard", code: "S", icon: "基", name: "ローズ基本形", sub: "Standard / S", note: "まず覚える基準のかたち" },
  { id: "rose-flat", code: "F", icon: "平", name: "ローズフラット", sub: "Flat / F", note: "平たく広がるローズの分岐" },
  { id: "mimura", code: "M", icon: "三", name: "三村流", sub: "Mimura", note: "中央の形を見分けるルート" },
  { id: "ohwaku", code: "O", icon: "大", name: "大和久流", sub: "Ohwaku", note: "辺への展開を意識するルート" },
  { id: "inoue", code: "I", icon: "井", name: "井上流", sub: "Inoue", note: "右辺へ伸びる形を反復" },
  { id: "tezuka", code: "T", icon: "手", name: "手塚システム", sub: "Tezuka System", note: "システムの入口8手を覚える" },
].map((opening) => ({ ...opening, lesson: window.OPENING_LESSONS[opening.id] }));

const els = Object.fromEntries([
  "homeScreen", "gameScreen", "openingGrid", "masteredCount", "miniBoard", "board",
  "homeButton", "backButton", "routeCode", "routeName", "routeIcon", "panelRouteName",
  "panelRouteSub", "streakCount", "currentStep", "messageCard", "messageKicker",
  "messageTitle", "messageText", "historyList", "hintButton", "resetButton",
  "replayButton", "resultOverlay", "resultMark", "resultEyebrow", "resultTitle",
  "resultText", "tryAgainButton", "chooseAnotherButton", "installGuide", "installClose",
  "turnDisc", "turnCaption", "modeLabel", "viewerControls", "viewerStep",
  "moveBackButton", "moveForwardButton", "colorPicker", "startDrillButton",
  "progressBlock", "lessonActions", "evaluationButton", "evaluationNote", "historyTitle",
].map((id) => [id, document.querySelector(`#${id}`)]));
els.resultDialog = document.querySelector(".result-dialog");
els.stepDots = [...document.querySelectorAll("#stepDots span")];
els.colorChoices = [...document.querySelectorAll(".color-choice")];

let board = createInitialBoard();
let activeOpening = null;
let mode = "viewer";
let currentPlayer = BLACK;
let selectedColor = BLACK;
let lastMove = null;
let hintSquare = null;
let locked = false;
let history = [];
let timeline = [];
let timelineIndex = 0;
let openingLength = 0;
let drillStep = 0;
let currentNode = null;
let viewerNode = null;
let evaluationsVisible = false;
let evaluations = new Map();
let evaluating = false;
let evaluationVersion = 0;
let progress = loadProgress();

function createInitialBoard() {
  const next = Array.from({ length: 8 }, () => Array(8).fill(EMPTY));
  next[3][3] = WHITE;
  next[3][4] = BLACK;
  next[4][3] = BLACK;
  next[4][4] = WHITE;
  return next;
}

function cloneBoard(source = board) {
  return source.map((row) => [...row]);
}

function opponentOf(player) {
  return player === BLACK ? WHITE : BLACK;
}

function toPosition(square) {
  return { x: square.toLowerCase().charCodeAt(0) - 97, y: Number(square[1]) - 1 };
}

function toSquare(x, y) {
  return `${String.fromCharCode(97 + x)}${y + 1}`;
}

function inside(x, y) {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

function flipsForMove(square, player, source = board) {
  const { x, y } = toPosition(square);
  if (!inside(x, y) || source[y][x] !== EMPTY) return [];
  const opponent = opponentOf(player);
  const flips = [];

  DIRECTIONS.forEach(([dx, dy]) => {
    const candidates = [];
    let cx = x + dx;
    let cy = y + dy;
    while (inside(cx, cy) && source[cy][cx] === opponent) {
      candidates.push([cx, cy]);
      cx += dx;
      cy += dy;
    }
    if (candidates.length && inside(cx, cy) && source[cy][cx] === player) {
      flips.push(...candidates);
    }
  });
  return flips;
}

function legalMoves(player, source = board) {
  const moves = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const square = toSquare(x, y);
      if (flipsForMove(square, player, source).length) moves.push(square);
    }
  }
  return moves;
}

function boardAfterMove(source, square, player) {
  const next = cloneBoard(source);
  const flips = flipsForMove(square, player, next);
  if (!flips.length) return null;
  const { x, y } = toPosition(square);
  next[y][x] = player;
  flips.forEach(([fx, fy]) => {
    next[fy][fx] = player;
  });
  return next;
}

function playMove(square, player) {
  const next = boardAfterMove(board, square, player);
  if (!next) return false;
  board = next;
  lastMove = square;
  return true;
}

function sequenceToMoves(sequence) {
  return sequence.match(/../g) || [];
}

function rebuildFromTimeline() {
  board = createInitialBoard();
  currentPlayer = BLACK;
  lastMove = null;
  history = [];
  for (let index = 0; index < timelineIndex; index += 1) {
    const square = timeline[index];
    if (!playMove(square, currentPlayer)) break;
    history.push({ player: currentPlayer, square });
    currentPlayer = opponentOf(currentPlayer);
    if (!legalMoves(currentPlayer).length && legalMoves(opponentOf(currentPlayer)).length) {
      currentPlayer = opponentOf(currentPlayer);
    }
  }
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem("rabbit-opening-progress-v3")) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem("rabbit-opening-progress-v3", JSON.stringify(progress));
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
    card.addEventListener("click", () => startLesson(card.dataset.opening));
  });
  els.masteredCount.textContent = OPENINGS.filter((opening) => (progress[opening.id] || 0) > 0).length;
}

function renderMiniBoard() {
  const position = "...................BB.B....BBB....BWBW....WWWW.....W............";
  els.miniBoard.innerHTML = [...position].map((piece) => `
    <span class="mini-cell">${piece === "." ? "" : `<i class="mini-disc ${piece === "B" ? "black" : "white"}"></i>`}</span>
  `).join("");
}

function showHome() {
  evaluationVersion += 1;
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
  enterViewer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function enterViewer() {
  mode = "viewer";
  locked = false;
  hintSquare = null;
  evaluationsVisible = false;
  evaluations.clear();
  timeline = sequenceToMoves(activeOpening.lesson.start);
  openingLength = timeline.length;
  timelineIndex = openingLength;
  rebuildFromTimeline();
  viewerNode = activeOpening.lesson.tree;
  setMessage(
    "OPENING VIEWER",
    `${activeOpening.name}の形です。`,
    "「1手戻る」で初期配置まで戻れます。評価値を表示したまま、盤面を自由に進めることもできます。",
  );
  render();
}

function startDrill() {
  mode = "drill";
  board = createInitialBoard();
  currentPlayer = BLACK;
  history = [];
  sequenceToMoves(activeOpening.lesson.start).forEach((move) => {
    playMove(move, currentPlayer);
    currentPlayer = opponentOf(currentPlayer);
  });
  currentNode = activeOpening.lesson.tree;
  drillStep = 0;
  lastMove = sequenceToMoves(activeOpening.lesson.start).at(-1);
  hintSquare = null;
  locked = false;
  evaluations.clear();
  els.resultOverlay.hidden = true;
  updateDrillMessage();
  render();
  scheduleComputerMove();
}

function updateDrillMessage() {
  const colorName = currentPlayer === BLACK ? "黒" : "白";
  if (currentPlayer === selectedColor) {
    setMessage("YOUR TURN", `${colorName}の最善手は？`, "間違えるとゲームオーバー。迷ったら「1手だけヒント」か評価値を使えます。");
  } else {
    setMessage("OPPONENT", `${colorName}が考えています。`, "相手側は定石の最善手を自動で進めます。");
  }
}

function render() {
  renderMode();
  renderBoard();
  renderProgress();
  renderHistory();
  if (evaluationsVisible) requestEvaluations();
}

function renderMode() {
  const viewer = mode === "viewer";
  const drill = mode === "drill";
  els.modeLabel.textContent = viewer ? "OPENING VIEWER" : drill ? "OPENING DRILL" : "FREE PLAY";
  els.viewerControls.hidden = !viewer;
  els.colorPicker.hidden = !viewer;
  els.startDrillButton.hidden = !viewer;
  els.progressBlock.hidden = !drill;
  els.lessonActions.hidden = !drill;
  els.viewerStep.textContent = timelineIndex;
  els.moveBackButton.disabled = timelineIndex === 0;
  els.moveForwardButton.disabled = timelineIndex >= timeline.length;
  els.historyTitle.textContent = viewer ? "ここまでの手順" : drill ? "このドリルの着手" : "自由対局の着手";
  els.replayButton.textContent = viewer ? "定石の形へ戻す ↺" : drill ? "最初からやり直す ↺" : "定石ゲームへ戻る ↺";
}

function renderBoard() {
  const legal = locked ? [] : legalMoves(currentPlayer);
  const canHumanPlay = mode === "viewer" || currentPlayer === selectedColor;
  const colorName = currentPlayer === BLACK ? "黒" : "白";
  els.turnDisc.className = currentPlayer === BLACK ? "black-disc" : "white-disc";
  els.turnCaption.textContent = evaluating
    ? `${colorName}番の評価値を計算中…`
    : `${colorName}番です。${evaluationsVisible ? "数字が大きいほど良い手です。" : "置ける場所を選んでください。"}`;
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
      } else if (legal.includes(square)) {
        cell.classList.add("playable");
        if (canHumanPlay) cell.addEventListener("click", () => handleMove(square));
        else cell.disabled = true;
        if (evaluationsVisible && evaluations.has(square)) {
          const value = evaluations.get(square);
          cell.innerHTML = `<span class="eval-value">${formatEval(value)}</span>`;
          if (value === Math.max(...evaluations.values())) cell.classList.add("best-eval");
        }
      }

      if (square === lastMove) cell.classList.add("last-move");
      if (square === hintSquare) cell.classList.add("hint");
      els.board.appendChild(cell);
    }
  }
}

function renderProgress() {
  els.currentStep.textContent = Math.min(drillStep + 1, DRILL_LENGTH);
  els.stepDots.forEach((dot, index) => {
    dot.className = "";
    if (index < drillStep) dot.classList.add("done");
    else if (index === drillStep && drillStep < DRILL_LENGTH) dot.classList.add("active");
  });
}

function renderHistory() {
  const shownHistory = mode === "viewer" ? history : history.slice(-DRILL_LENGTH);
  if (!shownHistory.length) {
    els.historyList.innerHTML = `<span class="history-empty">まだ着手はありません</span>`;
    return;
  }
  els.historyList.innerHTML = shownHistory.map((item, index) => `
    <span class="history-item ${mode === "viewer" && index >= openingLength ? "explore" : ""}">
      ${item.player === BLACK ? "●" : "○"} <b>${item.square.toUpperCase()}</b><small>${index + 1}</small>
    </span>
  `).join("");
}

function handleMove(square) {
  if (locked || !activeOpening) return;
  if (mode === "viewer") {
    timeline = timeline.slice(0, timelineIndex);
    timeline.push(square);
    timelineIndex += 1;
    playMove(square, currentPlayer);
    history.push({ player: currentPlayer, square });
    currentPlayer = nextPlayerAfterMove(currentPlayer);
    viewerNode = viewerNode?.children?.[square] || null;
    hintSquare = null;
    evaluations.clear();
    setMessage("FREE STUDY", `${square.toUpperCase()}に着手。`, "戻る・進むで手順を確認できます。評価値を表示したまま続けても大丈夫です。");
    render();
    return;
  }
  if (currentPlayer !== selectedColor) return;
  if (mode === "drill") handleDrillMove(square);
  else handleFreeMove(square, currentPlayer);
}

function nextPlayerAfterMove(player) {
  const opponent = opponentOf(player);
  if (legalMoves(opponent).length) return opponent;
  return legalMoves(player).length ? player : opponent;
}

function handleDrillMove(square) {
  const expectedMoves = currentNode?.bestMoves || [];
  if (!expectedMoves.includes(square)) {
    locked = true;
    hintSquare = expectedMoves[0];
    const answers = expectedMoves.map((move) => move.toUpperCase()).join(" / ");
    setMessage("MISS", `${square.toUpperCase()}ではない。`, `この形の最善手は ${answers}。`, "error");
    renderBoard();
    window.setTimeout(() => showResult(false, answers), 400);
    return;
  }
  advanceDrill(square, false);
}

function advanceDrill(square, computer) {
  const nodeBeforeMove = currentNode;
  const movingPlayer = currentPlayer;
  playMove(square, movingPlayer);
  history.push({ player: movingPlayer, square });
  drillStep += 1;
  hintSquare = null;
  evaluations.clear();
  currentNode = nodeBeforeMove.children[square] || null;

  if (drillStep >= DRILL_LENGTH) {
    completeDrill();
    return;
  }

  currentPlayer = currentNode.turn === "black" ? BLACK : WHITE;
  setMessage(
    computer ? "BEST MOVE" : "CORRECT",
    computer ? `${square.toUpperCase()}へ進みました。` : "その一手。",
    `8手中 ${drillStep}手を通過。次の最善手へ進みます。`,
    "success",
  );
  render();
  window.setTimeout(() => {
    if (mode !== "drill") return;
    updateDrillMessage();
    render();
    scheduleComputerMove();
  }, 380);
}

function scheduleComputerMove() {
  if (mode !== "drill" || locked || currentPlayer === selectedColor) return;
  locked = true;
  window.setTimeout(() => {
    if (mode !== "drill") return;
    locked = false;
    const move = currentNode.bestMoves[0];
    advanceDrill(move, true);
  }, 650);
}

function completeDrill() {
  progress[activeOpening.id] = (progress[activeOpening.id] || 0) + 1;
  saveProgress();
  els.streakCount.textContent = progress[activeOpening.id];
  mode = "free";
  locked = false;
  currentPlayer = nextPlayerAfterMove(currentPlayer);
  evaluationsVisible = true;
  evaluations.clear();
  setMessage("8 MOVES CLEAR", "8手、完全正解。", "ここからは自由対局です。評価値を見ながら、選んだ色で最後まで続けられます。", "success");
  render();
  scheduleFreeComputerMove();
}

function handleFreeMove(square, player) {
  playMove(square, player);
  history.push({ player, square });
  currentPlayer = nextPlayerAfterMove(player);
  evaluations.clear();
  const moves = legalMoves(currentPlayer);
  if (!moves.length && !legalMoves(opponentOf(currentPlayer)).length) {
    finishFreeGame();
    return;
  }
  setMessage("FREE PLAY", `${square.toUpperCase()}に着手。`, "評価値を見ながら続けよう。数字が最大のマスが、この端末AIのおすすめです。");
  render();
  scheduleFreeComputerMove();
}

function scheduleFreeComputerMove() {
  if (mode !== "free" || locked || currentPlayer === selectedColor) return;
  locked = true;
  requestEvaluationValues(board, currentPlayer).then((values) => {
    if (mode !== "free") return;
    const best = [...values.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    locked = false;
    if (best) handleFreeMove(best, currentPlayer);
  });
}

function finishFreeGame() {
  const counts = board.flat().reduce((result, piece) => {
    if (piece === BLACK) result.black += 1;
    if (piece === WHITE) result.white += 1;
    return result;
  }, { black: 0, white: 0 });
  locked = true;
  setMessage("GAME FINISHED", `黒 ${counts.black} — ${counts.white} 白`, counts.black === counts.white ? "引き分けです。" : `${counts.black > counts.white ? "黒" : "白"}の勝ちです。`, "success");
  render();
}

function stepViewer(delta) {
  if (mode !== "viewer") return;
  const nextIndex = Math.max(0, Math.min(timeline.length, timelineIndex + delta));
  if (nextIndex === timelineIndex) return;
  timelineIndex = nextIndex;
  evaluations.clear();
  hintSquare = null;
  rebuildFromTimeline();
  viewerNode = activeOpening.lesson.tree;
  if (timelineIndex < openingLength) {
    viewerNode = null;
  } else {
    for (const move of timeline.slice(openingLength, timelineIndex)) {
      viewerNode = viewerNode?.children?.[move] || null;
    }
  }
  const atOpening = timelineIndex === openingLength;
  setMessage(
    "OPENING VIEWER",
    timelineIndex === 0 ? "初期配置です。" : atOpening ? `${activeOpening.name}の形です。` : `${timelineIndex}手目の局面。`,
    "「1手戻る」「1手進む」で、石がどう変わるか確認できます。",
  );
  render();
}

function toggleEvaluations() {
  evaluationsVisible = !evaluationsVisible;
  evaluations.clear();
  els.evaluationButton.classList.toggle("active", evaluationsVisible);
  els.evaluationButton.textContent = evaluationsVisible ? "評価値を隠す" : "評価値を表示";
  els.evaluationNote.textContent = evaluationsVisible
    ? "定石上はEdax、定石外は端末内AIで評価します。"
    : "定石上はEdax、定石外は端末内AIで評価します。";
  renderBoard();
  if (evaluationsVisible) requestEvaluations();
}

function requestEvaluations() {
  if (!evaluationsVisible || locked || evaluating || evaluations.size || !legalMoves(currentPlayer).length) return;
  const version = ++evaluationVersion;
  evaluating = true;
  renderBoard();
  const snapshot = cloneBoard();
  const player = currentPlayer;
  window.setTimeout(async () => {
    const exactNode = mode === "viewer" ? viewerNode : mode === "drill" ? currentNode : null;
    const values = exactNode?.evaluations
      ? new Map(Object.entries(exactNode.evaluations))
      : await requestEvaluationValues(snapshot, player);
    if (version !== evaluationVersion || !evaluationsVisible) return;
    evaluations = values;
    evaluating = false;
    els.evaluationNote.textContent = exactNode?.evaluations
      ? "Othello! JAPAN（Edax）の評価値です。★が最善手です。"
      : "定石外の局面は端末内AIが評価します。★が最善候補です。";
    renderBoard();
  }, 20);
}

async function requestEvaluationValues(source, player) {
  const moves = legalMoves(player, source);
  const empties = source.flat().filter((piece) => piece === EMPTY).length;
  const depth = empties <= 11 ? Math.min(empties, 7) : window.innerWidth < 700 ? 3 : 4;
  const values = new Map();
  for (const move of moves) {
    const next = boardAfterMove(source, move, player);
    const score = -negamax(next, opponentOf(player), depth - 1, -Infinity, Infinity, player);
    values.set(move, Math.round(score / 10));
  }
  return values;
}

function negamax(source, player, depth, alpha, beta, rootPlayer) {
  const moves = legalMoves(player, source);
  const opponent = opponentOf(player);
  if (depth <= 0) return heuristic(source, rootPlayer) * (player === rootPlayer ? 1 : -1);
  if (!moves.length) {
    if (!legalMoves(opponent, source).length) {
      const diff = discDifference(source, rootPlayer);
      return (diff === 0 ? 0 : Math.sign(diff) * 100000 + diff) * (player === rootPlayer ? 1 : -1);
    }
    return -negamax(source, opponent, depth - 1, -beta, -alpha, rootPlayer);
  }
  let best = -Infinity;
  for (const move of orderedMoves(moves)) {
    const next = boardAfterMove(source, move, player);
    const score = -negamax(next, opponent, depth - 1, -beta, -alpha, rootPlayer);
    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }
  return best;
}

function orderedMoves(moves) {
  return [...moves].sort((a, b) => {
    const pa = toPosition(a);
    const pb = toPosition(b);
    return POSITION_WEIGHTS[pb.y][pb.x] - POSITION_WEIGHTS[pa.y][pa.x];
  });
}

function discDifference(source, player) {
  return source.flat().reduce((score, piece) => score + (piece === player ? 1 : piece === opponentOf(player) ? -1 : 0), 0);
}

function heuristic(source, player) {
  const opponent = opponentOf(player);
  let positional = 0;
  let frontier = 0;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const piece = source[y][x];
      if (piece === EMPTY) continue;
      const sign = piece === player ? 1 : -1;
      positional += POSITION_WEIGHTS[y][x] * sign;
      if (DIRECTIONS.some(([dx, dy]) => inside(x + dx, y + dy) && source[y + dy][x + dx] === EMPTY)) frontier -= 4 * sign;
    }
  }
  const mobility = (legalMoves(player, source).length - legalMoves(opponent, source).length) * 14;
  return positional + mobility + frontier + discDifference(source, player);
}

function formatEval(value) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function setMessage(kicker, title, text, state = "") {
  els.messageKicker.textContent = kicker;
  els.messageTitle.textContent = title;
  els.messageText.textContent = text;
  els.messageCard.className = `message-card ${state}`.trim();
}

function showHint() {
  if (mode !== "drill" || locked || currentPlayer !== selectedColor) return;
  hintSquare = currentNode.bestMoves[0];
  setMessage("HINT", `${hintSquare.toUpperCase()}を見る。`, currentNode.bestMoves.length > 1 ? `同評価の最善手が${currentNode.bestMoves.length}通りあります。そのうち1つを表示しました。` : "最善手のマスを点線で囲みました。");
  renderBoard();
}

function showResult(clear, expectedMoves = "") {
  els.resultDialog.classList.toggle("is-clear", clear);
  els.resultMark.textContent = clear ? "✓" : "×";
  els.resultEyebrow.textContent = clear ? "LESSON CLEAR" : "GAME OVER";
  els.resultTitle.textContent = clear ? "8手、完全正解。" : "そこで終了。";
  els.resultText.textContent = clear ? "評価値を見ながら自由対局へ進めます。" : `正解は ${expectedMoves}。同じ形からもう一度やり直そう。`;
  els.tryAgainButton.textContent = clear ? "自由対局へ進む" : "同じ定石でもう一度";
  els.resultOverlay.hidden = false;
}

function resetCurrentMode() {
  if (mode === "viewer") enterViewer();
  else startDrill();
}

els.homeButton.addEventListener("click", showHome);
els.backButton.addEventListener("click", showHome);
els.startDrillButton.addEventListener("click", startDrill);
els.moveBackButton.addEventListener("click", () => stepViewer(-1));
els.moveForwardButton.addEventListener("click", () => stepViewer(1));
els.evaluationButton.addEventListener("click", toggleEvaluations);
els.hintButton.addEventListener("click", showHint);
els.resetButton.addEventListener("click", resetCurrentMode);
els.replayButton.addEventListener("click", resetCurrentMode);
els.tryAgainButton.addEventListener("click", () => {
  els.resultOverlay.hidden = true;
  startDrill();
});
els.chooseAnotherButton.addEventListener("click", showHome);
els.colorChoices.forEach((button) => {
  button.addEventListener("click", () => {
    selectedColor = Number(button.dataset.color);
    els.colorChoices.forEach((choice) => choice.classList.toggle("active", choice === button));
  });
});
els.installClose.addEventListener("click", () => {
  els.installGuide.hidden = true;
  sessionStorage.setItem("install-guide-dismissed", "1");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !els.resultOverlay.hidden) els.resultOverlay.hidden = true;
  if (mode === "viewer" && event.key === "ArrowLeft") stepViewer(-1);
  if (mode === "viewer" && event.key === "ArrowRight") stepViewer(1);
});

renderMiniBoard();
renderHome();

const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
const guideDismissed = sessionStorage.getItem("install-guide-dismissed") === "1";
document.body.classList.toggle("standalone", isStandalone);
if (isIOS && !isStandalone && !guideDismissed) {
  window.setTimeout(() => {
    els.installGuide.hidden = false;
  }, 800);
}
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}
