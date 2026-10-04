"use strict";

const MEOWDOKU_GAME_STATE = (() => {
  const VALID_MARKS = new Set(["empty", "cross", "cat", "wrong"]);
  const VALID_MEMO_MARKS = new Set(["empty", "cross", "cat"]);

  function createGame(levelIndex, options) {
    const {
      cellCount,
      size,
      maxLives,
      autoCross = true,
      completedLevelIds = []
    } = options;
    return {
      levelIndex,
      marks: Array(cellCount ?? size * size).fill("empty"),
      memoMarks: Array(cellCount ?? size * size).fill("empty"),
      memoMode: false,
      lives: maxLives,
      autoCross,
      completedLevelIds: [...completedLevelIds],
      completed: false,
      selected: null,
      hint: null
    };
  }

  function normalizeGame(saved, options) {
    const { levels, maxLives } = options;
    if (!saved || typeof saved !== "object") {
      return null;
    }
    if (!Number.isInteger(saved.levelIndex) || !levels[saved.levelIndex]) {
      return null;
    }
    const cellCount = levels[saved.levelIndex].size ** 2;
    if (
      !Array.isArray(saved.marks) ||
      saved.marks.length !== cellCount ||
      saved.marks.some((mark) => !VALID_MARKS.has(mark))
    ) {
      return null;
    }
    const memoMarks = saved.memoMarks === undefined
      ? Array(cellCount).fill("empty")
      : saved.memoMarks;
    if (
      !Array.isArray(memoMarks) ||
      memoMarks.length !== cellCount ||
      memoMarks.some((mark) => !VALID_MEMO_MARKS.has(mark))
    ) {
      return null;
    }
    if (
      !Number.isInteger(saved.lives) ||
      saved.lives < 0 ||
      saved.lives > maxLives
    ) {
      return null;
    }

    const selected = saved.selected === null ||
      (Number.isInteger(saved.selected) && saved.selected >= 0 && saved.selected < cellCount)
      ? saved.selected
      : null;
    const validLevelIds = new Set(levels.map((level) => level.id));
    let completedLevelIds;
    if (Array.isArray(saved.completedLevelIds)) {
      completedLevelIds = [...new Set(saved.completedLevelIds)].filter(
        (levelId) => validLevelIds.has(levelId)
      );
    } else if (Array.isArray(saved.completedLevels)) {
      completedLevelIds = [...new Set(saved.completedLevels)]
        .filter((levelIndex) => Number.isInteger(levelIndex) && Boolean(levels[levelIndex]))
        .map((levelIndex) => levels[levelIndex].id);
    } else {
      completedLevelIds = saved.completed === true
        ? [levels[saved.levelIndex].id]
        : [];
    }

    return {
      levelIndex: saved.levelIndex,
      marks: [...saved.marks],
      memoMarks: [...memoMarks],
      memoMode: saved.memoMode === true,
      lives: saved.lives,
      autoCross: typeof saved.autoCross === "boolean" ? saved.autoCross : true,
      completedLevelIds,
      completed: saved.completed === true,
      selected,
      hint: null
    };
  }

  function loadGame(storage, key, options) {
    try {
      return normalizeGame(JSON.parse(storage.getItem(key)), options);
    } catch {
      return null;
    }
  }

  function saveGame(storage, key, state) {
    try {
      storage.setItem(key, JSON.stringify(state));
      return true;
    } catch {
      return false;
    }
  }

  function findResumeLevelIndex(state, levels) {
    const currentLevel = levels[state.levelIndex];
    const isEmpty = state.marks.every((mark) => mark === "empty");
    if (
      !currentLevel ||
      !isEmpty ||
      !state.completedLevelIds.includes(currentLevel.id)
    ) {
      return state.levelIndex;
    }

    const firstIncomplete = levels.findIndex(
      (level) => !state.completedLevelIds.includes(level.id)
    );
    return firstIncomplete === -1 ? state.levelIndex : firstIncomplete;
  }

  return { createGame, normalizeGame, loadGame, saveGame, findResumeLevelIndex };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_GAME_STATE;
} else {
  globalThis.MEOWDOKU_GAME_STATE = MEOWDOKU_GAME_STATE;
}
