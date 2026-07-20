"use strict";

const MEOWDOKU_RULES = (() => {
  const SIZE = 5;

  function toIndex(row, column) {
    return row * SIZE + column;
  }

  function toRowCol(index) {
    return [Math.floor(index / SIZE), index % SIZE];
  }

  function getRegion(level, index) {
    const [row, column] = toRowCol(index);
    return level.regions[row][column];
  }

  function conflictsWithCat(level, index, catIndex) {
    const [row, column] = toRowCol(index);
    const [catRow, catColumn] = toRowCol(catIndex);

    return row === catRow ||
      column === catColumn ||
      getRegion(level, index) === getRegion(level, catIndex) ||
      (
        Math.abs(row - catRow) <= 1 &&
        Math.abs(column - catColumn) <= 1
      );
  }

  function findRuleIssues(level, placedCats) {
    const issues = new Set();

    for (let i = 0; i < placedCats.length; i += 1) {
      for (let j = i + 1; j < placedCats.length; j += 1) {
        if (conflictsWithCat(level, placedCats[i], placedCats[j])) {
          issues.add(placedCats[i]);
          issues.add(placedCats[j]);
        }
      }
    }

    return [...issues];
  }

  return {
    SIZE,
    toIndex,
    toRowCol,
    getRegion,
    conflictsWithCat,
    findRuleIssues
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_RULES;
} else {
  globalThis.MEOWDOKU_RULES = MEOWDOKU_RULES;
}
