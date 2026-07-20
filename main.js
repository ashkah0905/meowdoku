"use strict";

const SAVE_KEY = "meowdoku-logic-v1";
const SIZE = 5;
const CELL_COUNT = SIZE * SIZE;
const MAX_LIVES = 3;
const EMPTY = "empty";
const CROSS = "cross";
const CAT = "cat";
const WRONG = "wrong";

const LEVELS = globalThis.MEOWDOKU_LEVELS;

const boardEl = document.querySelector("#board");
const levelTitle = document.querySelector("#levelTitle");
const catCount = document.querySelector("#catCount");
const lifeHearts = document.querySelector("#lifeHearts");
const autoCrossToggle = document.querySelector("#autoCrossToggle");
const statusText = document.querySelector("#statusText");
const prevLevelBtn = document.querySelector("#prevLevelBtn");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const resetBtn = document.querySelector("#resetBtn");
const hintBtn = document.querySelector("#hintBtn");
const autoSolveBtn = document.querySelector("#autoSolveBtn");
const checkBtn = document.querySelector("#checkBtn");
const resultDialog = document.querySelector("#resultDialog");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");
const closeDialogBtn = document.querySelector("#closeDialogBtn");

let state = loadGame() || createGame(0);
let dialogMode = null;
let isAutoSolving = false;

function createGame(levelIndex, autoCross = true) {
  return {
    levelIndex,
    marks: Array(CELL_COUNT).fill(EMPTY),
    lives: MAX_LIVES,
    autoCross,
    completed: false,
    selected: null,
    hint: null
  };
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || !Array.isArray(saved.marks) || saved.marks.length !== CELL_COUNT) {
      return null;
    }
    if (typeof saved.levelIndex !== "number" || !LEVELS[saved.levelIndex]) {
      return null;
    }
    return {
      ...saved,
      lives: Number.isInteger(saved.lives) ? saved.lives : MAX_LIVES,
      autoCross: typeof saved.autoCross === "boolean" ? saved.autoCross : true
    };
  } catch {
    return null;
  }
}

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function getLevel() {
  return LEVELS[state.levelIndex];
}

function toIndex(row, col) {
  return row * SIZE + col;
}

function toRowCol(index) {
  return [Math.floor(index / SIZE), index % SIZE];
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
  levelTitle.textContent = level.name;
  catCount.textContent = `${foundCatCount()}/${SIZE}`;
  lifeHearts.textContent = "❤".repeat(state.lives) + "♡".repeat(MAX_LIVES - state.lives);
  autoCrossToggle.checked = state.autoCross;
  autoSolveBtn.hidden = !canShowAutoSolve();
  autoSolveBtn.disabled = isAutoSolving;

  boardEl.innerHTML = "";
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const [row, col] = toRowCol(index);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `cell color-${level.regions[row][col]}`;
    cell.dataset.index = String(index);
    cell.setAttribute("aria-label", `${row + 1}行 ${col + 1}列`);

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
    setStatus("ここにはいなさそう、という印をつけました。");
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
  setStatus("そこにはネコはいません。ライフが1つ減りました。");
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

function checkBoard() {
  const placedCats = state.marks
    .map((mark, index) => mark === CAT ? index : null)
    .filter((index) => index !== null);

  const ruleIssues = findRuleIssues(placedCats);
  if (ruleIssues.length === 0) {
    setStatus("現在の配置にはルール違反がありません。正解かどうかは完成時に判定します。");
  } else {
    setStatus("同じ行・列・色、または隣接しているネコを見直しましょう。");
  }
  render();
}

function findRuleIssues(placedCats) {
  const issues = new Set();

  for (let i = 0; i < placedCats.length; i += 1) {
    const [rowA, colA] = toRowCol(placedCats[i]);
    for (let j = i + 1; j < placedCats.length; j += 1) {
      const [rowB, colB] = toRowCol(placedCats[j]);
      const sameRow = rowA === rowB;
      const sameCol = colA === colB;
      const sameRegion = getRegion(placedCats[i]) === getRegion(placedCats[j]);
      const adjacent = Math.abs(rowA - rowB) <= 1 && Math.abs(colA - colB) <= 1;
      if (sameRow || sameCol || sameRegion || adjacent) {
        issues.add(placedCats[i]);
        issues.add(placedCats[j]);
      }
    }
  }

  return [...issues];
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
  return findCrossesFromPlacedCat() ||
    findSingleCandidateHint() ||
    findRegionLineHint() ||
    findContradictionHint();
}

function findCrossesFromPlacedCat() {
  const placedCats = getPlacedCats();
  for (const catIndex of placedCats) {
    const targets = getEmptyIndexes().filter((index) => conflictsWithCat(index, catIndex));
    if (targets.length > 0) {
      return {
        primary: [catIndex],
        targets,
        message: "置いたネコと同じ行・列・色、または周囲のマスにはもうネコを置けません。光っているマスは×にできます。"
      };
    }
  }
  return null;
}

function findSingleCandidateHint() {
  for (let row = 0; row < SIZE; row += 1) {
    const candidates = getUnitCandidates((index) => toRowCol(index)[0] === row);
    if (candidates.length === 1) {
      return {
        primary: candidates,
        targets: [],
        message: `${row + 1}行目でネコを置ける場所は、このマスだけです。`
      };
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    const candidates = getUnitCandidates((index) => toRowCol(index)[1] === col);
    if (candidates.length === 1) {
      return {
        primary: candidates,
        targets: [],
        message: `${col + 1}列目でネコを置ける場所は、このマスだけです。`
      };
    }
  }

  for (let region = 0; region < SIZE; region += 1) {
    const candidates = getUnitCandidates((index) => getRegion(index) === region);
    if (candidates.length === 1) {
      return {
        primary: candidates,
        targets: [],
        message: `この色でネコを置ける場所は、このマスだけです。`
      };
    }
  }

  return null;
}

function findRegionLineHint() {
  for (let region = 0; region < SIZE; region += 1) {
    const candidates = getUnitCandidates((index) => getRegion(index) === region);
    if (candidates.length <= 1) {
      continue;
    }

    const rows = new Set(candidates.map((index) => toRowCol(index)[0]));
    if (rows.size === 1) {
      const row = [...rows][0];
      const targets = getEmptyIndexes().filter((index) => {
        const [targetRow] = toRowCol(index);
        return targetRow === row && getRegion(index) !== region && isLegalCandidate(index);
      });
      if (targets.length > 0) {
        return {
          primary: candidates,
          targets,
          message: `この色の候補は${row + 1}行目にしかありません。なので、同じ行の別の色のマスは×にできます。`
        };
      }
    }

    const cols = new Set(candidates.map((index) => toRowCol(index)[1]));
    if (cols.size === 1) {
      const col = [...cols][0];
      const targets = getEmptyIndexes().filter((index) => {
        const [, targetCol] = toRowCol(index);
        return targetCol === col && getRegion(index) !== region && isLegalCandidate(index);
      });
      if (targets.length > 0) {
        return {
          primary: candidates,
          targets,
          message: `この色の候補は${col + 1}列目にしかありません。なので、同じ列の別の色のマスは×にできます。`
        };
      }
    }
  }

  return null;
}

function findContradictionHint() {
  for (const index of getEmptyIndexes()) {
    if (!isLegalCandidate(index)) {
      continue;
    }

    const contradiction = findContradictionAfterCat(index);
    if (contradiction) {
      return {
        primary: [index],
        targets: contradiction.targets,
        message: `このマスにネコを置くと、${contradiction.label}に置ける場所がなくなります。ここは×にできます。`
      };
    }
  }

  return null;
}

function findContradictionAfterCat(index) {
  const simulatedCats = [...getPlacedCats(), index];

  for (let row = 0; row < SIZE; row += 1) {
    if (simulatedCats.some((catIndex) => toRowCol(catIndex)[0] === row)) {
      continue;
    }
    const targets = getEmptyIndexes().filter((candidate) => toRowCol(candidate)[0] === row && isLegalCandidate(candidate, simulatedCats));
    if (targets.length === 0) {
      return { label: `${row + 1}行目`, targets: indexesInRow(row) };
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    if (simulatedCats.some((catIndex) => toRowCol(catIndex)[1] === col)) {
      continue;
    }
    const targets = getEmptyIndexes().filter((candidate) => toRowCol(candidate)[1] === col && isLegalCandidate(candidate, simulatedCats));
    if (targets.length === 0) {
      return { label: `${col + 1}列目`, targets: indexesInCol(col) };
    }
  }

  for (let region = 0; region < SIZE; region += 1) {
    if (simulatedCats.some((catIndex) => getRegion(catIndex) === region)) {
      continue;
    }
    const targets = getEmptyIndexes().filter((candidate) => getRegion(candidate) === region && isLegalCandidate(candidate, simulatedCats));
    if (targets.length === 0) {
      return { label: "同じ色のエリア", targets: indexesInRegion(region) };
    }
  }

  return null;
}

function canShowAutoSolve() {
  if (state.completed || state.lives <= 0 || state.marks.includes(WRONG)) {
    return false;
  }

  const remaining = SIZE - foundCatCount();
  return remaining > 0 && remaining <= 2 && Boolean(buildAutoSolvePlan());
}

function buildAutoSolvePlan() {
  const cats = catIndexes();
  const working = [...state.marks];
  const additions = [];
  let changed = true;

  while (changed) {
    changed = false;

    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (working[index] === CAT) {
        for (const target of getConflictingIndexes(index)) {
          if (working[target] === EMPTY) {
            working[target] = CROSS;
            changed = true;
          }
        }
      }
    }

    const single = findWorkingSingleCandidate(working);
    if (single !== null && working[single] === EMPTY) {
      if (!cats.has(single)) {
        return null;
      }
      working[single] = CAT;
      additions.push(single);
      changed = true;
    }
  }

  const allFound = [...cats].every((index) => working[index] === CAT);
  return allFound && additions.length > 0 ? additions : null;
}

function findWorkingSingleCandidate(working) {
  for (let row = 0; row < SIZE; row += 1) {
    const candidates = getWorkingUnitCandidates(working, (index) => toRowCol(index)[0] === row);
    if (candidates.length === 1) {
      return candidates[0];
    }
  }

  for (let col = 0; col < SIZE; col += 1) {
    const candidates = getWorkingUnitCandidates(working, (index) => toRowCol(index)[1] === col);
    if (candidates.length === 1) {
      return candidates[0];
    }
  }

  for (let region = 0; region < SIZE; region += 1) {
    const candidates = getWorkingUnitCandidates(working, (index) => getRegion(index) === region);
    if (candidates.length === 1) {
      return candidates[0];
    }
  }

  return null;
}

function getWorkingUnitCandidates(working, predicate) {
  return working
    .map((mark, index) => mark === EMPTY && predicate(index) && isWorkingLegalCandidate(working, index) ? index : null)
    .filter((index) => index !== null);
}

function isWorkingLegalCandidate(working, index) {
  if (working[index] !== EMPTY) {
    return false;
  }

  const placedCats = working
    .map((mark, catIndex) => mark === CAT ? catIndex : null)
    .filter((catIndex) => catIndex !== null);
  return placedCats.every((catIndex) => !conflictsWithCat(index, catIndex));
}

function getConflictingIndexes(index) {
  const indexes = [];
  for (let target = 0; target < CELL_COUNT; target += 1) {
    if (target !== index && conflictsWithCat(target, index)) {
      indexes.push(target);
    }
  }
  return indexes;
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

function getPlacedCats() {
  return state.marks
    .map((mark, index) => mark === CAT ? index : null)
    .filter((index) => index !== null);
}

function getEmptyIndexes() {
  return state.marks
    .map((mark, index) => mark === EMPTY ? index : null)
    .filter((index) => index !== null);
}

function getUnitCandidates(predicate) {
  return getEmptyIndexes().filter((index) => predicate(index) && isLegalCandidate(index));
}

function isLegalCandidate(index, placedCats = getPlacedCats()) {
  if (state.marks[index] === CROSS) {
    return false;
  }
  return placedCats.every((catIndex) => catIndex === index || !conflictsWithCat(index, catIndex));
}

function conflictsWithCat(index, catIndex) {
  const [row, col] = toRowCol(index);
  const [catRow, catCol] = toRowCol(catIndex);
  const sameRow = row === catRow;
  const sameCol = col === catCol;
  const sameRegion = getRegion(index) === getRegion(catIndex);
  const adjacent = Math.abs(row - catRow) <= 1 && Math.abs(col - catCol) <= 1;
  return sameRow || sameCol || sameRegion || adjacent;
}

function getRegion(index) {
  const [row, col] = toRowCol(index);
  return getLevel().regions[row][col];
}

function indexesInRow(row) {
  return Array.from({ length: SIZE }, (_, col) => toIndex(row, col));
}

function indexesInCol(col) {
  return Array.from({ length: SIZE }, (_, row) => toIndex(row, col));
}

function indexesInRegion(region) {
  const indexes = [];
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (getRegion(index) === region) {
      indexes.push(index);
    }
  }
  return indexes;
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
    setStatus("すべてのネコを見つけました。");
    openDialog("クリア", "ネコたちが満足そうに並びました。");
    return true;
  }

  return false;
}

function openDialog(title, text) {
  dialogMode = title === "クリア" ? "clear" : "message";
  resultTitle.textContent = title;
  resultText.textContent = text;
  resultDialog.classList.add("open");
  resultDialog.setAttribute("aria-hidden", "false");
}

function closeDialog() {
  dialogMode = null;
  resultDialog.classList.remove("open");
  resultDialog.setAttribute("aria-hidden", "true");
}

function resetLevel() {
  isAutoSolving = false;
  state = createGame(state.levelIndex, state.autoCross);
  closeDialog();
  setStatus("このレベルを最初からやり直します。");
  render();
}

function changeLevel(step) {
  isAutoSolving = false;
  const nextIndex = (state.levelIndex + step + LEVELS.length) % LEVELS.length;
  state = createGame(nextIndex, state.autoCross);
  closeDialog();
  setStatus(`${getLevel().name} を開始しました。`);
  render();
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
resetBtn.addEventListener("click", resetLevel);
hintBtn.addEventListener("click", revealHint);
autoSolveBtn.addEventListener("click", autoSolve);
checkBtn.addEventListener("click", checkBoard);
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

document.addEventListener("keydown", (event) => {
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
