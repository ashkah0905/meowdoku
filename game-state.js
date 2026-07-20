"use strict";

const MEOWDOKU_GAME_STATE = (() => {
  const VALID_MARKS = new Set(["empty", "cross", "cat", "wrong"]);

  function createGame(levelIndex, options) {
    const { cellCount, maxLives, autoCross = true } = options;
    return {
      levelIndex,
      marks: Array(cellCount).fill("empty"),
      lives: maxLives,
      autoCross,
      completed: false,
      selected: null,
      hint: null
    };
  }

  function normalizeGame(saved, options) {
    const { levels, cellCount, maxLives } = options;
    if (!saved || typeof saved !== "object") {
      return null;
    }
    if (!Number.isInteger(saved.levelIndex) || !levels[saved.levelIndex]) {
      return null;
    }
    if (
      !Array.isArray(saved.marks) ||
      saved.marks.length !== cellCount ||
      saved.marks.some((mark) => !VALID_MARKS.has(mark))
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

    return {
      levelIndex: saved.levelIndex,
      marks: [...saved.marks],
      lives: saved.lives,
      autoCross: typeof saved.autoCross === "boolean" ? saved.autoCross : true,
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
    storage.setItem(key, JSON.stringify(state));
  }

  return { createGame, normalizeGame, loadGame, saveGame };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_GAME_STATE;
} else {
  globalThis.MEOWDOKU_GAME_STATE = MEOWDOKU_GAME_STATE;
}
