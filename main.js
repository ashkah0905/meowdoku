"use strict";

const SAVE_KEY = "meowdoku-logic-v1";
const { toIndex, toRowCol } = globalThis.MEOWDOKU_RULES;
const MAX_LIVES = 3;
const EMPTY = "empty";
const CROSS = "cross";
const CAT = "cat";
const WRONG = "wrong";

const generatedLevelStore = globalThis.MEOWDOKU_GENERATED_LEVEL_STORE;
let storage = null;
try {
  storage = localStorage;
} catch {
  // Storage can be unavailable even when the browser can run the game.
}
let hasSaveFailure = !storage;

function levelNumber(level) {
  return Number(level.id.slice(6));
}

const LEVELS = [
  ...globalThis.MEOWDOKU_LEVELS,
  ...generatedLevelStore.loadGeneratedLevels(storage)
].sort((levelA, levelB) => levelNumber(levelA) - levelNumber(levelB));

const boardEl = document.querySelector("#board");
const homeScreen = document.querySelector("#homeScreen");
const gameScreen = document.querySelector("#gameScreen");
const homeLevelTitle = document.querySelector("#homeLevelTitle");
const homeDifficultyBadge = document.querySelector("#homeDifficultyBadge");
const homeClearCount = document.querySelector("#homeClearCount");
const continueBtn = document.querySelector("#continueBtn");
const homeBtn = document.querySelector("#homeBtn");
const levelTitle = document.querySelector("#levelTitle");
const difficultyBadge = document.querySelector("#difficultyBadge");
const catCount = document.querySelector("#catCount");
const clearCount = document.querySelector("#clearCount");
const lifeHearts = document.querySelector("#lifeHearts");
const autoCrossToggle = document.querySelector("#autoCrossToggle");
const statusText = document.querySelector("#statusText");
const toast = document.querySelector("#toast");
const saveWarning = document.querySelector("#saveWarning");
const resetBtn = document.querySelector("#resetBtn");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const hintBtn = document.querySelector("#hintBtn");
const memoBtn = document.querySelector("#memoBtn");
const resetMemoBtn = document.querySelector("#resetMemoBtn");
const autoSolveBtn = document.querySelector("#autoSolveBtn");
const resultDialog = document.querySelector("#resultDialog");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const closeDialogBtn = document.querySelector("#closeDialogBtn");
const levelTransition = document.querySelector("#levelTransition");
const transitionLevelTitle = document.querySelector("#transitionLevelTitle");
const transitionProgress = document.querySelector("#transitionProgress");
const TRANSITION_FADE_MS = 100;
const TRANSITION_HOLD_MS = 700;
const TRANSITION_FINISH_MS = 200;

const DIFFICULTY_LABELS = {
  normal: "",
  hard: "HARD",
  "super-hard": "SUPER HARD"
};

const loadedState = loadGame();
let state = loadedState ? resumeGame(loadedState) : createGame(0);
let dialogMode = null;
let isAutoSolving = false;
let isChangingLevel = false;
let dialogReturnFocus = null;
let crossDrag = null;
let suppressNextClick = false;
let toastTimer = null;
let celebrationIndex = null;
let celebrationTimer = null;
const LONG_PRESS_DELAY = 500;
const MOVE_TOLERANCE = 8;
let generationWorker = null;
let generationRequestId = 0;
const generationRequests = new Map();
const pendingGeneration = new Map();

try {
  generationWorker = new Worker("./level-worker.js?v=2");
  generationWorker.addEventListener("message", (event) => {
    const { requestId, level } = event.data;
    const request = generationRequests.get(requestId);
    if (!request) {
      return;
    }
    generationRequests.delete(requestId);
    request.resolve(saveAndRegisterGeneratedLevel(level));
  });
  generationWorker.addEventListener("error", () => {
    generationWorker = null;
    for (const request of generationRequests.values()) {
      generateOnMainThread(request.levelNumber)
        .then(saveAndRegisterGeneratedLevel)
        .then(request.resolve);
    }
    generationRequests.clear();
  });
} catch {
  generationWorker = null;
}

function saveAndRegisterGeneratedLevel(level) {
  if (!level || !generatedLevelStore.isValidGeneratedLevel(level)) {
    return null;
  }
  if (!generatedLevelStore.saveGeneratedLevel(storage, level)) {
    hasSaveFailure = true;
  }
  if (!LEVELS.some((savedLevel) => savedLevel.id === level.id)) {
    LEVELS.push(level);
    LEVELS.sort((levelA, levelB) => levelNumber(levelA) - levelNumber(levelB));
  }
  render();
  return level;
}

function generateOnMainThread(targetLevelNumber) {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      try {
        const options = globalThis.MEOWDOKU_PROGRESSION
          .getGenerationOptions(targetLevelNumber);
        const result = globalThis.MEOWDOKU_LEVEL_GENERATOR.generateLevel(options);
        resolve(result?.level ?? null);
      } catch {
        resolve(null);
      }
    }, 0);
  });
}

function ensureGeneratedLevel(targetLevelNumber) {
  const levelId = `stage-${String(targetLevelNumber).padStart(3, "0")}`;
  const existing = LEVELS.find((level) => level.id === levelId);
  if (existing) {
    return Promise.resolve(existing);
  }
  const pending = pendingGeneration.get(targetLevelNumber);
  if (pending) {
    return pending;
  }
  if (!generationWorker) {
    const fallback = generateOnMainThread(targetLevelNumber)
      .then(saveAndRegisterGeneratedLevel)
      .finally(() => pendingGeneration.delete(targetLevelNumber));
    pendingGeneration.set(targetLevelNumber, fallback);
    return fallback;
  }

  const requestId = generationRequestId;
  generationRequestId += 1;
  const request = new Promise((resolve) => {
    generationRequests.set(requestId, { levelNumber: targetLevelNumber, resolve });
    generationWorker.postMessage({ requestId, levelNumber: targetLevelNumber });
  }).finally(() => pendingGeneration.delete(targetLevelNumber));
  pendingGeneration.set(targetLevelNumber, request);
  return request;
}

async function prefetchGeneratedLevels(firstLevelNumber, count) {
  for (let offset = 0; offset < count; offset += 1) {
    const level = await ensureGeneratedLevel(firstLevelNumber + offset);
    if (!level) {
      return;
    }
  }
}

function createGame(levelIndex, autoCross = true, completedLevelIds = []) {
  return globalThis.MEOWDOKU_GAME_STATE.createGame(levelIndex, {
    size: LEVELS[levelIndex].size,
    maxLives: MAX_LIVES,
    autoCross,
    completedLevelIds
  });
}

function loadGame() {
  return globalThis.MEOWDOKU_GAME_STATE.loadGame(storage, SAVE_KEY, {
    levels: LEVELS,
    maxLives: MAX_LIVES
  });
}

function saveGame() {
  if (!globalThis.MEOWDOKU_GAME_STATE.saveGame(storage, SAVE_KEY, state)) {
    hasSaveFailure = true;
  }
}

function resumeGame(savedState) {
  const resumeIndex = globalThis.MEOWDOKU_GAME_STATE
    .findResumeLevelIndex(savedState, LEVELS);
  if (resumeIndex === savedState.levelIndex) {
    return savedState;
  }
  return createGame(resumeIndex, savedState.autoCross, savedState.completedLevelIds);
}

function getLevel() {
  return LEVELS[state.levelIndex];
}

function getSize() {
  return getLevel().size;
}

function getCellCount() {
  return getSize() ** 2;
}

function catIndexes() {
  return new Set(getLevel().cats.map(([row, col]) => toIndex(row, col, getSize())));
}

function isCorrectCat(index) {
  return catIndexes().has(index);
}

function foundCatCount() {
  const cats = catIndexes();
  return state.marks.filter((mark, index) => mark === CAT && cats.has(index)).length;
}

function render() {
  const focusedCellIndex = boardEl.contains(document.activeElement)
    ? document.activeElement.dataset.index
    : null;
  const level = getLevel();
  const isPreviouslyCompleted = state.completedLevelIds.includes(level.id);
  const difficultyLabel = DIFFICULTY_LABELS[level.difficulty];
  boardEl.setAttribute("aria-label", `${level.size}行${level.size}列の盤面`);
  levelTitle.textContent = `${level.name}${isPreviouslyCompleted ? " ✓" : ""}`;
  difficultyBadge.textContent = difficultyLabel;
  difficultyBadge.hidden = !difficultyLabel;
  difficultyBadge.dataset.difficulty = level.difficulty;
  catCount.textContent = `${foundCatCount()}/${level.size}`;
  clearCount.textContent = `${state.completedLevelIds.length}問`;
  renderHome();
  lifeHearts.textContent = "❤".repeat(state.lives) + "♡".repeat(MAX_LIVES - state.lives);
  autoCrossToggle.checked = state.autoCross;
  memoBtn.classList.toggle("memo-active", state.memoMode);
  memoBtn.setAttribute("aria-pressed", String(state.memoMode));
  resetMemoBtn.hidden = !state.memoMode;
  autoSolveBtn.hidden = !canShowAutoSolve();
  autoSolveBtn.disabled = isAutoSolving;
  nextLevelBtn.hidden = !state.completed;
  nextLevelBtn.disabled = isChangingLevel;

  boardEl.innerHTML = "";
  boardEl.style.setProperty("--board-size", String(level.size));
  boardEl.dataset.size = String(level.size);
  for (let index = 0; index < getCellCount(); index += 1) {
    const [row, col] = toRowCol(index, level.size);
    const region = level.regions[row][col];
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `cell color-${region}`;
    cell.dataset.index = String(index);
    const markLabels = {
      [EMPTY]: "空",
      [CROSS]: "ネコなし",
      [CAT]: "ネコ",
      [WRONG]: "ミス"
    };
    const memoLabel = state.memoMarks[index] === CAT
      ? "、メモのネコ"
      : state.memoMarks[index] === CROSS
        ? "、メモのネコなし"
        : "";
    cell.setAttribute(
      "aria-label",
      `${row + 1}行 ${col + 1}列、エリア${region + 1}、${markLabels[state.marks[index]]}${memoLabel}`
    );

    if (state.selected === index) {
      cell.classList.add("selected");
    }
    if (state.completed) {
      cell.classList.add("locked");
    }
    if (state.hint?.primary?.includes(index)) {
      cell.classList.add("hinted");
    }
    if (state.hint?.targets?.includes(index)) {
      cell.classList.add("hint-target");
    }
    if (state.marks[index] === CAT && isCorrectCat(index)) {
      cell.classList.add("revealed");
    }
    if (celebrationIndex === index) {
      cell.classList.add("celebrating");
    }
    const mark = document.createElement("span");
    mark.className = "mark";
    if (state.marks[index] === CROSS) {
      mark.classList.add("cross-mark");
      mark.textContent = "×";
    } else if (state.marks[index] === WRONG) {
      mark.classList.add("wrong-mark");
      mark.textContent = "×";
    } else if (state.marks[index] === CAT) {
      mark.classList.add("cat-mark");
      mark.textContent = "🐱";
    } else if (state.memoMarks[index] === CROSS) {
      mark.classList.add("cross-mark", "memo-mark");
      mark.textContent = "×";
    } else if (state.memoMarks[index] === CAT) {
      mark.classList.add("cat-mark", "memo-mark");
      mark.textContent = "🐱";
    }
    cell.appendChild(mark);
    boardEl.appendChild(cell);
  }

  if (focusedCellIndex !== null && !resultDialog.classList.contains("open")) {
    boardEl.querySelector(`[data-index="${focusedCellIndex}"]`)?.focus();
  }
  saveWarning.hidden = !hasSaveFailure;
}

function renderHome() {
  const level = getLevel();
  const difficultyLabel = DIFFICULTY_LABELS[level.difficulty];
  homeLevelTitle.textContent = level.name;
  homeDifficultyBadge.textContent = difficultyLabel;
  homeDifficultyBadge.hidden = !difficultyLabel;
  homeDifficultyBadge.dataset.difficulty = level.difficulty;
  homeClearCount.textContent = `クリア ${state.completedLevelIds.length}問`;
}

function showHome() {
  closeDialog();
  gameScreen.hidden = true;
  homeScreen.hidden = false;
  renderHome();
  continueBtn.focus();
}

function showGame() {
  homeScreen.hidden = true;
  gameScreen.hidden = false;
  render();
  boardEl.querySelector(".cell")?.focus();
}

function setStatus(message, visible = false) {
  statusText.textContent = message;
  if (!visible) {
    return;
  }
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function toggleCross(index) {
  if (isChangingLevel || isAutoSolving || state.completed || state.lives <= 0) {
    return;
  }

  state.selected = index;
  state.hint = null;
  if (state.memoMode) {
    if (state.marks[index] !== EMPTY) {
      setStatus("確定済みのマスにはメモできません。", true);
    } else {
      state.memoMarks[index] = state.memoMarks[index] === CROSS ? EMPTY : CROSS;
      setStatus(state.memoMarks[index] === CROSS ? "メモの×をつけました。" : "メモを消しました。");
    }
    saveGame();
    render();
    return;
  }
  const current = state.marks[index];
  state.memoMarks[index] = EMPTY;
  if (current === EMPTY) {
    state.marks[index] = CROSS;
    setStatus("ネコがいない印をつけました。");
  } else if (current === CROSS) {
    state.marks[index] = EMPTY;
    setStatus("×を取り消しました。");
  } else if (current === CAT || current === WRONG) {
    state.marks[index] = EMPTY;
    setStatus("マスを空に戻しました。");
  }

  checkComplete();
  saveGame();
  render();
}

function placeCat(index) {
  const activeMark = state.memoMode ? state.memoMarks[index] : state.marks[index];
  if (
    isChangingLevel || isAutoSolving || state.completed || state.lives <= 0 ||
    (activeMark !== EMPTY && activeMark !== CROSS && !(state.memoMode && activeMark === CAT))
  ) {
    return;
  }
  state.selected = index;
  state.hint = null;
  if (state.memoMode) {
    if (state.marks[index] !== EMPTY) {
      setStatus("確定済みのマスにはメモできません。", true);
    } else {
      state.memoMarks[index] = state.memoMarks[index] === CAT ? EMPTY : CAT;
      setStatus(state.memoMarks[index] === CAT ? "メモのネコを置きました。" : "メモを消しました。");
    }
    navigator.vibrate?.(20);
    saveGame();
    render();
    return;
  }
  const placedCorrectly = isCorrectCat(index);
  state.memoMarks[index] = EMPTY;
  state.marks[index] = CAT;
  handleCatPlaced(index);
  if (placedCorrectly) {
    celebrateCorrectCat(index);
  }
  checkComplete();
  navigator.vibrate?.(30);
  saveGame();
  render();
}

function celebrateCorrectCat(index) {
  window.clearTimeout(celebrationTimer);
  celebrationIndex = index;
  celebrationTimer = window.setTimeout(() => {
    boardEl.querySelector(`[data-index="${index}"]`)?.classList.remove("celebrating");
    celebrationIndex = null;
  }, 550);
}

function markCrossDuringDrag(cell) {
  const index = Number(cell.dataset.index);
  const marks = state.memoMode ? state.memoMarks : state.marks;
  if (
    crossDrag.touched.has(index) ||
    marks[index] !== EMPTY ||
    (state.memoMode && state.marks[index] !== EMPTY)
  ) {
    return;
  }

  crossDrag.touched.add(index);
  marks[index] = CROSS;
  if (!state.memoMode) {
    state.memoMarks[index] = EMPTY;
  }
  state.selected = index;
  state.hint = null;
  const mark = cell.querySelector(".mark");
  mark.className = `mark cross-mark${state.memoMode ? " memo-mark" : ""}`;
  mark.textContent = "×";
}

function finishCrossDrag(event) {
  if (!crossDrag || event.pointerId !== crossDrag.pointerId) {
    return;
  }

  window.clearTimeout(crossDrag.longPressTimer);
  const gesture = crossDrag;
  crossDrag = null;

  if (event.type === "pointercancel" && gesture.touched.size > 0) {
    saveGame();
    render();
  }

  if (event.type !== "pointercancel" && !gesture.longPressed) {
    if (gesture.dragging) {
      setStatus("×をつけました。");
      saveGame();
      render();
    } else if (!gesture.moved) {
      toggleCross(gesture.startIndex);
    }
  }

  window.setTimeout(() => {
    suppressNextClick = false;
  }, 0);
}

function handleCatPlaced(index) {
  if (isCorrectCat(index)) {
    if (state.autoCross) {
      markObviousCrosses(index);
    }
    setStatus("ネコを見つけました。");
    return;
  }

  state.marks[index] = WRONG;
  state.lives = Math.max(0, state.lives - 1);
  setStatus("ミス！ ライフが1つ減りました。");
  if (state.lives === 0) {
    openDialog("ゲームオーバー", "ライフがなくなりました。リセットして再挑戦できます。");
  }
}

function markObviousCrosses(index) {
  const [row, col] = toRowCol(index, getSize());
  const region = getLevel().regions[row][col];

  for (let target = 0; target < getCellCount(); target += 1) {
    if (state.marks[target] !== EMPTY) {
      continue;
    }

    const [targetRow, targetCol] = toRowCol(target, getSize());
    const sameRow = targetRow === row;
    const sameCol = targetCol === col;
    const sameRegion = getLevel().regions[targetRow][targetCol] === region;
    const adjacent = Math.abs(targetRow - row) <= 1 && Math.abs(targetCol - col) <= 1;

    if (sameRow || sameCol || sameRegion || adjacent) {
      state.marks[target] = CROSS;
      state.memoMarks[target] = EMPTY;
    }
  }
}

function revealHint() {
  if (state.completed || state.lives <= 0) {
    return;
  }

  const hint = findLogicHint();
  if (!hint) {
    setStatus("今の盤面では、すぐ説明できるヒントが見つかりませんでした。チェックや仮置きを試してみましょう。", true);
    state.hint = null;
    render();
    return;
  }

  state.hint = hint;
  state.selected = hint.primary[0] ?? hint.targets[0] ?? null;
  setStatus(hint.message, true);
  render();
}

function findLogicHint() {
  return globalThis.MEOWDOKU_SOLVER.findLogicHint(getLevel(), state.marks);
}

function canShowAutoSolve() {
  if (state.completed || state.lives <= 0 || state.marks.includes(WRONG)) {
    return false;
  }

  const remaining = getSize() - foundCatCount();
  return remaining > 0 && remaining <= 2 && Boolean(buildAutoSolvePlan());
}

function buildAutoSolvePlan() {
  return globalThis.MEOWDOKU_SOLVER.buildAutoSolvePlan(getLevel(), state.marks);
}

function autoSolve() {
  if (isAutoSolving) {
    return;
  }

  const plan = buildAutoSolvePlan();
  if (!plan) {
    setStatus("まだロジックだけでは仕上げられません。もう少し絞り込みましょう。", true);
    render();
    return;
  }

  for (const index of plan) {
    state.marks[index] = CAT;
    if (state.autoCross) {
      markObviousCrosses(index);
    }
  }
  state.hint = { primary: plan, targets: [], message: "残りのネコをロジックで仕上げました。" };
  isAutoSolving = true;
  saveGame();
  setStatus("残りのネコをロジックで仕上げました。", true);
  render();
  window.setTimeout(() => {
    isAutoSolving = false;
    checkComplete();
    saveGame();
    render();
  }, 650);
}

function checkComplete() {
  if (state.completed) {
    return true;
  }

  const cats = catIndexes();
  const allFound = [...cats].every((index) => state.marks[index] === CAT);
  const noWrongCats = state.marks.every((mark, index) => mark !== CAT || cats.has(index));

  if (allFound && noWrongCats) {
    state.completed = true;
    const levelId = getLevel().id;
    if (!state.completedLevelIds.includes(levelId)) {
      state.completedLevelIds.push(levelId);
    }
    setStatus("すべてのネコを見つけました。");
    openDialog("クリア", "ネコたちが満足そうに並びました。");
    return true;
  }

  return false;
}

function openDialog(title, text) {
  const activeElement = document.activeElement;
  dialogReturnFocus = Number.isInteger(state.selected)
    ? { cellIndex: String(state.selected) }
    : { element: activeElement };
  dialogMode = title === "クリア" ? "clear" : "message";
  resultTitle.textContent = title;
  resultText.textContent = text;
  closeDialogBtn.textContent = dialogMode === "clear" ? "つづける" : "もどる";
  resultDialog.classList.add("open");
  resultDialog.setAttribute("aria-hidden", "false");
  closeDialogBtn.focus();
}

function closeDialog() {
  dialogMode = null;
  resultDialog.classList.remove("open");
  resultDialog.setAttribute("aria-hidden", "true");
  if (dialogReturnFocus?.cellIndex !== undefined) {
    boardEl.querySelector(`[data-index="${dialogReturnFocus.cellIndex}"]`)?.focus();
  } else {
    dialogReturnFocus?.element?.focus();
  }
  dialogReturnFocus = null;
}

function resetLevel() {
  if (isChangingLevel) {
    return;
  }
  isAutoSolving = false;
  state = createGame(state.levelIndex, state.autoCross, state.completedLevelIds);
  closeDialog();
  setStatus("このレベルを最初からやり直します。");
  saveGame();
  render();
}

function toggleMemoMode() {
  if (state.completed || state.lives <= 0 || isAutoSolving) {
    return;
  }
  state.memoMode = !state.memoMode;
  setStatus(state.memoMode
    ? "メモモードです。タップで小さい×、長押しで小さいネコを置けます。"
    : "メモモードを終了しました。", true);
  saveGame();
  render();
}

function resetMemo() {
  state.memoMarks.fill(EMPTY);
  setStatus("メモをすべて消しました。");
  saveGame();
  render();
}

function selectLevel(levelIndex) {
  isAutoSolving = false;
  state = createGame(levelIndex, state.autoCross, state.completedLevelIds);
  closeDialog();
  setStatus(`${getLevel().name} を開始しました。`);
  saveGame();
  render();
  const selectedLevelNumber = levelNumber(getLevel());
  if (selectedLevelNumber > globalThis.MEOWDOKU_LEVELS.length) {
    prefetchGeneratedLevels(selectedLevelNumber + 1, 2);
  }
}

async function changeLevel(step) {
  if (isChangingLevel) {
    return;
  }

  isChangingLevel = true;
  closeDialogBtn.disabled = true;
  const currentLevelNumber = levelNumber(getLevel());
  try {
    if (step > 0) {
      const targetLevelNumber = currentLevelNumber + step;
      closeDialog();
      window.clearTimeout(toastTimer);
      toast.hidden = true;
      transitionLevelTitle.textContent = `レベル ${targetLevelNumber}`;
      transitionProgress.setAttribute("aria-valuetext", "次の問題を準備中");
      levelTransition.hidden = false;
      gameScreen.inert = true;
      gameScreen.setAttribute("aria-busy", "true");
      gameScreen.classList.add("level-leaving");
      levelTransition.focus();
      render();
      // Let the transition paint before a main-thread generation fallback starts.
      await new Promise((resolve) => window.setTimeout(resolve, TRANSITION_FADE_MS));
      levelTransition.classList.add("level-preparing");
      const [nextLevel] = await Promise.all([
        ensureGeneratedLevel(targetLevelNumber),
        new Promise((resolve) => window.setTimeout(resolve, TRANSITION_HOLD_MS))
      ]);
      if (!nextLevel) {
        closeDialog();
        setStatus("問題を準備できませんでした。ページを再読み込みしてお試しください。", true);
        render();
        return;
      }
      levelTransition.classList.add("level-ready");
      transitionProgress.setAttribute("aria-valuetext", "準備完了");
      await new Promise((resolve) => window.setTimeout(resolve, TRANSITION_FINISH_MS));
      const nextIndex = LEVELS.findIndex((level) => level.id === nextLevel.id);
      selectLevel(nextIndex);
      gameScreen.classList.remove("level-leaving");
      levelTransition.classList.add("level-arriving");
      await new Promise((resolve) => window.setTimeout(resolve, TRANSITION_FADE_MS));
      return;
    }

    const nextIndex = (state.levelIndex + step + LEVELS.length) % LEVELS.length;
    selectLevel(nextIndex);
  } finally {
    isChangingLevel = false;
    closeDialogBtn.disabled = false;
    nextLevelBtn.disabled = false;
    levelTransition.hidden = true;
    levelTransition.classList.remove("level-arriving");
    levelTransition.classList.remove("level-preparing");
    levelTransition.classList.remove("level-ready");
    gameScreen.classList.remove("level-leaving");
    gameScreen.inert = false;
    gameScreen.setAttribute("aria-busy", "false");
    if (!gameScreen.hidden) {
      (state.completed ? nextLevelBtn : boardEl.querySelector(".cell"))?.focus();
    }
  }
}

boardEl.addEventListener("click", (event) => {
  if (suppressNextClick) {
    suppressNextClick = false;
    return;
  }
  const cell = event.target.closest(".cell");
  if (!cell) {
    return;
  }
  toggleCross(Number(cell.dataset.index));
});

boardEl.addEventListener("keydown", (event) => {
  if (
    event.key.toLowerCase() !== "c" || event.repeat ||
    event.ctrlKey || event.altKey || event.metaKey ||
    resultDialog.classList.contains("open")
  ) {
    return;
  }
  const cell = event.target.closest(".cell");
  if (cell) {
    event.preventDefault();
    placeCat(Number(cell.dataset.index));
  }
});

boardEl.addEventListener("pointerdown", (event) => {
  const cell = event.target.closest(".cell");
  const index = Number(cell?.dataset.index);
  if (
    !event.isPrimary ||
    event.button !== 0 ||
    !cell ||
    state.completed ||
    state.lives <= 0 ||
    isAutoSolving
  ) {
    return;
  }

  crossDrag = {
    pointerId: event.pointerId,
    startCell: cell,
    startIndex: index,
    startMark: state.memoMode ? state.memoMarks[index] : state.marks[index],
    startX: event.clientX,
    startY: event.clientY,
    touched: new Set(),
    moved: false,
    dragging: false,
    longPressed: false,
    longPressTimer: null,
  };

  const activeMark = state.memoMode ? state.memoMarks[index] : state.marks[index];
  if (activeMark === EMPTY || activeMark === CROSS) {
    crossDrag.longPressTimer = window.setTimeout(() => {
      crossDrag.longPressed = true;
      placeCat(index);
    }, LONG_PRESS_DELAY);
  }

  boardEl.setPointerCapture(event.pointerId);
  suppressNextClick = true;
});

boardEl.addEventListener("pointermove", (event) => {
  if (!crossDrag || event.pointerId !== crossDrag.pointerId) {
    return;
  }
  event.preventDefault();
  const distance = Math.hypot(
    event.clientX - crossDrag.startX,
    event.clientY - crossDrag.startY,
  );
  if (distance > MOVE_TOLERANCE) {
    crossDrag.moved = true;
    window.clearTimeout(crossDrag.longPressTimer);
  }

  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest(".cell");
  if (
    cell &&
    boardEl.contains(cell) &&
    cell !== crossDrag.startCell &&
    crossDrag.startMark === EMPTY
  ) {
    crossDrag.dragging = true;
    markCrossDuringDrag(crossDrag.startCell);
    markCrossDuringDrag(cell);
  }
});

boardEl.addEventListener("pointerup", finishCrossDrag);
boardEl.addEventListener("pointercancel", finishCrossDrag);
boardEl.addEventListener("contextmenu", (event) => {
  if (crossDrag) {
    event.preventDefault();
  }
});

continueBtn.addEventListener("click", showGame);
homeBtn.addEventListener("click", showHome);
resetBtn.addEventListener("click", resetLevel);
nextLevelBtn.addEventListener("click", () => changeLevel(1));
hintBtn.addEventListener("click", revealHint);
memoBtn.addEventListener("click", toggleMemoMode);
resetMemoBtn.addEventListener("click", resetMemo);
autoSolveBtn.addEventListener("click", autoSolve);
autoCrossToggle.addEventListener("change", () => {
  state.autoCross = autoCrossToggle.checked;
  setStatus(
    state.autoCross
      ? "ネコ発見時の自動×をオンにしました。"
      : "ネコ発見時の自動×をオフにしました。"
  );
  saveGame();
  render();
});
closeDialogBtn.addEventListener("click", () => {
  if (dialogMode === "clear") {
    return changeLevel(1);
  } else {
    closeDialog();
  }
});
resultDialog.querySelector(".dialog-backdrop").addEventListener("click", closeDialog);

document.addEventListener("keydown", (event) => {
  if (isChangingLevel) {
    return;
  }
  if (event.key === "Escape" && resultDialog.classList.contains("open")) {
    closeDialog();
    return;
  }

  if (event.key.toLowerCase() === "r" && !gameScreen.hidden) {
    resetLevel();
  } else if (event.key.toLowerCase() === "h" && !gameScreen.hidden) {
    revealHint();
  }
});

showHome();
prefetchGeneratedLevels(11, 2);
