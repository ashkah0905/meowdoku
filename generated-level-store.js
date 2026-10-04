"use strict";

const MEOWDOKU_GENERATED_LEVEL_STORE = (() => {
  const STORAGE_KEY = "meowdoku-generated-levels-v1";
  const GENERATOR_VERSION = 1;
  const DIFFICULTIES = new Set(["normal", "hard", "super-hard"]);

  function isValidGeneratedLevel(level) {
    if (!level || typeof level !== "object") {
      return false;
    }
    const { id, name, size, difficulty, regions, cats } = level;
    if (
      typeof id !== "string" || !/^stage-\d{3,}$/.test(id) ||
      typeof name !== "string" ||
      !Number.isInteger(size) || size < 5 || size > 8 ||
      !DIFFICULTIES.has(difficulty) ||
      !Array.isArray(regions) || regions.length !== size ||
      !Array.isArray(cats) || cats.length !== size
    ) {
      return false;
    }
    if (regions.some((row) =>
      !Array.isArray(row) ||
      row.length !== size ||
      row.some((region) => !Number.isInteger(region) || region < 0 || region >= size)
    )) {
      return false;
    }
    if (new Set(regions.flat()).size !== size) {
      return false;
    }
    if (cats.some(([row, column]) =>
      !Number.isInteger(row) || row < 0 || row >= size ||
      !Number.isInteger(column) || column < 0 || column >= size
    )) {
      return false;
    }
    if (
      new Set(cats.map(([row]) => row)).size !== size ||
      new Set(cats.map(([, column]) => column)).size !== size ||
      new Set(cats.map(([row, column]) => regions[row][column])).size !== size
    ) {
      return false;
    }
    return cats.every(([, column], row) =>
      row === 0 || Math.abs(column - cats[row - 1][1]) > 1
    );
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function loadGeneratedLevels(storage) {
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY));
      if (
        !saved ||
        saved.generatorVersion !== GENERATOR_VERSION ||
        !Array.isArray(saved.levels)
      ) {
        return [];
      }
      return clone(saved.levels.filter(isValidGeneratedLevel));
    } catch {
      return [];
    }
  }

  function findGeneratedLevel(storage, levelId) {
    return loadGeneratedLevels(storage).find((level) => level.id === levelId) ?? null;
  }

  function saveGeneratedLevel(storage, level) {
    if (!isValidGeneratedLevel(level)) {
      return false;
    }
    const levels = loadGeneratedLevels(storage).filter((saved) => saved.id !== level.id);
    levels.push(clone(level));
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ generatorVersion: GENERATOR_VERSION, levels }));
      return true;
    } catch {
      return false;
    }
  }

  function removeInvalidGeneratedLevels(storage) {
    const levels = loadGeneratedLevels(storage);
    storage.setItem(STORAGE_KEY, JSON.stringify({ generatorVersion: GENERATOR_VERSION, levels }));
    return levels;
  }

  return {
    STORAGE_KEY,
    GENERATOR_VERSION,
    isValidGeneratedLevel,
    loadGeneratedLevels,
    findGeneratedLevel,
    saveGeneratedLevel,
    removeInvalidGeneratedLevels
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_GENERATED_LEVEL_STORE;
} else {
  globalThis.MEOWDOKU_GENERATED_LEVEL_STORE = MEOWDOKU_GENERATED_LEVEL_STORE;
}
