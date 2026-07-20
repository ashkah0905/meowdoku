"use strict";

const SAVE_KEY = "meowdoku-logic-v1";
const { toIndex, toRowCol } = globalThis.MEOWDOKU_RULES;
const MAX_LIVES = 3;
const EMPTY = "empty";
const CROSS = "cross";
const CAT = "cat";
const WRONG = "wrong";

const generatedLevelStore = globalThis.MEOWDOKU_GENERATED_LEVEL_STORE;

function levelNumber(level) {
  return Number(level.id.slice(6));
}

const LEVELS = [
  ...globalThis.MEOWDOKU_LEVELS,
  ...generatedLevelStore.loadGeneratedLevels(localStorage)
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
const resetBtn = document.querySelector("#resetBtn");
const hintBtn = document.querySelector("#hintBtn");
const autoSolveBtn = document.querySelector("#autoSolveBtn");
const resultDialog = document.querySelector("#resultDialog");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const closeDialogBtn = document.querySelector("#closeDialogBtn");

const DIFFICULTY_LABELS = {
  normal: "",
  hard: "HARD",
  "super-hard": "SUPER HARD"
};

let state = loadGame() || createGame(0);
let dialogMode = null;
let isAutoSolving = false;
let dialogReturnFocus = null;
let generationWorker = null;
let generationRequestId = 0;
const generationRequests = new Map();
const pendingGeneration = new Map();

try {
  generationWorker = new Worker("./level-worker.js");
  generationWorker.addEventListener("message", (event) => {
    const { requestId, level } = event.data;
    const request = generationRequests.get(requestId);
    generationRequests.delete(requestId);
    request?.resolve(saveAndRegisterGeneratedLevel(level));
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
  if (!level || !generatedLevelStore.saveGeneratedLevel(localStorage, level)) {
    return null;
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
  return globalThis.MEOWDOKU_GAME_STATE.loadGame(localStorage, SAVE_KEY, {
    levels: LEVELS,
    maxLives: MAX_LIVES
  });
}

function saveGame() {
  globalThis.MEOWDOKU_GAME_STATE.saveGame(localStorage, SAVE_KEY, state);
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
  const level = getLevel();
  const isPreviouslyCompleted = state.completedLevelIds.includes(level.id);
  const difficultyLabel = DIFFICULTY_LABELS[level.difficulty];
  boardEl.setAttribute("aria-label", `${level.size}行${level.size}列の盤面`);
  levelTitle.textContent = `${level.name}${isPreviouslyCompleted ? " ✓" : ""}`;
  difficultyBadge.textContent = difficultyLabel;
  difficultyBadge.hidden = !difficultyLabel;
  difficultyBadge.dataset.difficulty = level.difficulty;
  catCount.textContent = `${foundCatCount()}/${level.size}`;
  clearCount.textContent = `クリア ${state.completedLevelIds.length}問`;
  renderHome();
  lifeHearts.textContent = "❤".repeat(state.lives) + "♡".repeat(MAX_LIVES - state.lives);
  autoCrossToggle.checked = state.autoCross;
  autoSolveBtn.hidden = !canShowAutoSolve();
  autoSolveBtn.disabled = isAutoSolving;

  boardEl.innerHTML = "";
  boardEl.style.setProperty("--board-size", String(level.size));
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
    cell.setAttribute(
      "aria-label",
      `${row + 1}行 ${col + 1}列、エリア${region + 1}、${markLabels[state.marks[index]]}`
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
    }
    cell.appendChild(mark);
    boardEl.appendChild(cell);
  }

  saveGame();
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

function setStatus(message) {
  statusText.textContent = message;
}

function cycleMark(index) {
  if (isAutoSolving || state.completed || state.lives <= 0) {
    return;
  }

  state.selected = index;
  state.hint = null;
  const current = state.marks[index];
  if (current === EMPTY) {
    state.marks[index] = CROSS;
    setStatus("ネコがいない印をつけました。");
  } else if (current === CROSS) {
    state.marks[index] = CAT;
    handleCatPlaced(index);
  } else if (current === CAT || current === WRONG) {
    state.marks[index] = EMPTY;
    setStatus("マスを空に戻しました。");
  }

  checkComplete();
  render();
}

function handleCatPlaced(index) {
  if (isCorrectCat(index)) {
    if (state.autoCross) {
      markObviousCrosses(index);
      setStatus("ネコを見つけました。関連するマスへ自動で×を入れました。");
    } else {
      setStatus("ネコを見つけました。");
    }
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
    }
  }
}

function revealHint() {
  if (state.completed || state.lives <= 0) {
    return;
  }

  const hint = findLogicHint();
  if (!hint) {
    setStatus("今の盤面では、すぐ説明できるヒントが見つかりませんでした。チェックや仮置きを試してみましょう。");
    state.hint = null;
    render();
    return;
  }

  state.hint = hint;
  state.selected = hint.primary[0] ?? hint.targets[0] ?? null;
  setStatus(hint.message);
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

function getConflictingIndexes(index) {
  return globalThis.MEOWDOKU_SOLVER.getConflictingIndexes(getLevel(), index);
}

function autoSolve() {
  if (isAutoSolving) {
    return;
  }

  const plan = buildAutoSolvePlan();
  if (!plan) {
    setStatus("まだロジックだけでは仕上げられません。もう少し絞り込みましょう。");
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
  setStatus("残りのネコをロジックで仕上げました。");
  render();
  window.setTimeout(() => {
    isAutoSolving = false;
    checkComplete();
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
  isAutoSolving = false;
  state = createGame(state.levelIndex, state.autoCross, state.completedLevelIds);
  closeDialog();
  setStatus("このレベルを最初からやり直します。");
  render();
}

function selectLevel(levelIndex) {
  isAutoSolving = false;
  state = createGame(levelIndex, state.autoCross, state.completedLevelIds);
  closeDialog();
  setStatus(`${getLevel().name} を開始しました。`);
  render();
  const selectedLevelNumber = levelNumber(getLevel());
  if (selectedLevelNumber > globalThis.MEOWDOKU_LEVELS.length) {
    prefetchGeneratedLevels(selectedLevelNumber + 1, 2);
  }
}

async function changeLevel(step) {
  if (step > 0 && state.levelIndex === LEVELS.length - 1) {
    setStatus("次の問題を準備しています…");
    render();
    const nextLevel = await ensureGeneratedLevel(levelNumber(getLevel()) + 1);
    if (!nextLevel) {
      closeDialog();
      setStatus("問題を準備できませんでした。ページを再読み込みしてお試しください。");
      render();
      return;
    }
  }
  const nextIndex = (state.levelIndex + step + LEVELS.length) % LEVELS.length;
  selectLevel(nextIndex);
}

boardEl.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) {
    return;
  }
  cycleMark(Number(cell.dataset.index));
});

continueBtn.addEventListener("click", showGame);
homeBtn.addEventListener("click", showHome);
resetBtn.addEventListener("click", resetLevel);
hintBtn.addEventListener("click", revealHint);
autoSolveBtn.addEventListener("click", autoSolve);
autoCrossToggle.addEventListener("change", () => {
  state.autoCross = autoCrossToggle.checked;
  setStatus(
    state.autoCross
      ? "ネコ発見時の自動×をオンにしました。"
      : "ネコ発見時の自動×をオフにしました。"
  );
  render();
});
closeDialogBtn.addEventListener("click", () => {
  if (dialogMode === "clear") {
    changeLevel(1);
  } else {
    closeDialog();
  }
});
resultDialog.querySelector(".dialog-backdrop").addEventListener("click", closeDialog);

document.addEventListener("keydown", (event) => {
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
