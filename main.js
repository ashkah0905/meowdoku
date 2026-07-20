"use strict";

const SAVE_KEY = "meowdoku-logic-v1";
const { SIZE, toIndex, toRowCol } = globalThis.MEOWDOKU_RULES;
const CELL_COUNT = SIZE * SIZE;
const MAX_LIVES = 3;
const EMPTY = "empty";
const CROSS = "cross";
const CAT = "cat";
const WRONG = "wrong";

const LEVELS = globalThis.MEOWDOKU_LEVELS;

const boardEl = document.querySelector("#board");
const levelTitle = document.querySelector("#levelTitle");
const levelPickerBtn = document.querySelector("#levelPickerBtn");
const levelDialog = document.querySelector("#levelDialog");
const levelList = document.querySelector("#levelList");
const closeLevelDialogBtn = document.querySelector("#closeLevelDialogBtn");
const catCount = document.querySelector("#catCount");
const clearCount = document.querySelector("#clearCount");
const lifeHearts = document.querySelector("#lifeHearts");
const autoCrossToggle = document.querySelector("#autoCrossToggle");
const statusText = document.querySelector("#statusText");
const prevLevelBtn = document.querySelector("#prevLevelBtn");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const resetBtn = document.querySelector("#resetBtn");
const hintBtn = document.querySelector("#hintBtn");
const autoSolveBtn = document.querySelector("#autoSolveBtn");
const resultDialog = document.querySelector("#resultDialog");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const closeDialogBtn = document.querySelector("#closeDialogBtn");

let state = loadGame() || createGame(0);
let dialogMode = null;
let isAutoSolving = false;
let dialogReturnFocus = null;

function createGame(levelIndex, autoCross = true, completedLevelIds = []) {
  return globalThis.MEOWDOKU_GAME_STATE.createGame(levelIndex, {
    cellCount: CELL_COUNT,
    maxLives: MAX_LIVES,
    autoCross,
    completedLevelIds
  });
}

function loadGame() {
  return globalThis.MEOWDOKU_GAME_STATE.loadGame(localStorage, SAVE_KEY, {
    levels: LEVELS,
    cellCount: CELL_COUNT,
    maxLives: MAX_LIVES
  });
}

function saveGame() {
  globalThis.MEOWDOKU_GAME_STATE.saveGame(localStorage, SAVE_KEY, state);
}

function getLevel() {
  return LEVELS[state.levelIndex];
}

function catIndexes() {
  return new Set(getLevel().cats.map(([row, col]) => toIndex(row, col)));
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
  levelTitle.textContent = `${level.name}${isPreviouslyCompleted ? " ✓" : ""}`;
  catCount.textContent = `${foundCatCount()}/${SIZE}`;
  clearCount.textContent = `${state.completedLevelIds.length}/${LEVELS.length}`;
  renderLevelList();
  lifeHearts.textContent = "❤".repeat(state.lives) + "♡".repeat(MAX_LIVES - state.lives);
  autoCrossToggle.checked = state.autoCross;
  autoSolveBtn.hidden = !canShowAutoSolve();
  autoSolveBtn.disabled = isAutoSolving;

  boardEl.innerHTML = "";
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const [row, col] = toRowCol(index);
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

function renderLevelList() {
  levelList.innerHTML = "";
  LEVELS.forEach((level, levelIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-option";
    button.dataset.levelIndex = String(levelIndex);

    const completed = state.completedLevelIds.includes(level.id);
    const current = state.levelIndex === levelIndex;
    button.textContent = [
      level.name,
      completed ? "✓ クリア" : "未クリア",
      current ? "プレイ中" : ""
    ].filter(Boolean).join("・");

    if (current) {
      button.classList.add("current");
      button.setAttribute("aria-current", "true");
    }
    levelList.appendChild(button);
  });
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
  const [row, col] = toRowCol(index);
  const region = getLevel().regions[row][col];

  for (let target = 0; target < CELL_COUNT; target += 1) {
    if (state.marks[target] !== EMPTY) {
      continue;
    }

    const [targetRow, targetCol] = toRowCol(target);
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

  const remaining = SIZE - foundCatCount();
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

function openLevelDialog() {
  renderLevelList();
  levelDialog.classList.add("open");
  levelDialog.setAttribute("aria-hidden", "false");
  levelList.querySelector(`[data-level-index="${state.levelIndex}"]`)?.focus();
}

function closeLevelDialog() {
  levelDialog.classList.remove("open");
  levelDialog.setAttribute("aria-hidden", "true");
  levelPickerBtn.focus();
}

function selectLevel(levelIndex) {
  isAutoSolving = false;
  state = createGame(levelIndex, state.autoCross, state.completedLevelIds);
  if (levelDialog.classList.contains("open")) {
    closeLevelDialog();
  }
  closeDialog();
  setStatus(`${getLevel().name} を開始しました。`);
  render();
}

function changeLevel(step) {
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

prevLevelBtn.addEventListener("click", () => changeLevel(-1));
nextLevelBtn.addEventListener("click", () => changeLevel(1));
levelPickerBtn.addEventListener("click", openLevelDialog);
closeLevelDialogBtn.addEventListener("click", closeLevelDialog);
levelDialog.querySelector(".dialog-backdrop").addEventListener("click", closeLevelDialog);
levelList.addEventListener("click", (event) => {
  const option = event.target.closest(".level-option");
  if (!option) {
    return;
  }
  selectLevel(Number(option.dataset.levelIndex));
});
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
  if (event.key === "Escape" && levelDialog.classList.contains("open")) {
    closeLevelDialog();
    return;
  }

  if (event.key === "Escape" && resultDialog.classList.contains("open")) {
    closeDialog();
    return;
  }

  if (event.key === "ArrowLeft") {
    changeLevel(-1);
  } else if (event.key === "ArrowRight") {
    changeLevel(1);
  } else if (event.key.toLowerCase() === "r") {
    resetLevel();
  } else if (event.key.toLowerCase() === "h") {
    revealHint();
  }
});

render();
