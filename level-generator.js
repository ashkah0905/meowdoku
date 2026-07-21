"use strict";

const MEOWDOKU_LEVEL_GENERATOR = (() => {
  const { analyzeLevel } = typeof module !== "undefined" && module.exports
    ? require("./level-analyzer.js")
    : globalThis.MEOWDOKU_LEVEL_ANALYZER;

  function createSeededRandom(seed) {
    let state = Array.from(String(seed)).reduce(
      (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619),
      2166136261
    ) >>> 0;
    return () => {
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffledColumns(size, random) {
    const columns = Array.from({ length: size }, (_, index) => index);
    for (let index = columns.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [columns[index], columns[target]] = [columns[target], columns[index]];
    }
    return columns;
  }

  function generateCatColumns(size, random) {
    const columns = Array(size).fill(-1);
    const usedColumns = new Set();

    function placeRow(row) {
      if (row === size) {
        return true;
      }
      for (const column of shuffledColumns(size, random)) {
        if (
          usedColumns.has(column) ||
          (row > 0 && Math.abs(column - columns[row - 1]) <= 1)
        ) {
          continue;
        }
        columns[row] = column;
        usedColumns.add(column);
        if (placeRow(row + 1)) {
          return true;
        }
        usedColumns.delete(column);
      }
      columns[row] = -1;
      return false;
    }

    return placeRow(0) ? columns : null;
  }

  function growConnectedRegions(size, cats, random) {
    const regions = Array.from({ length: size }, () => Array(size).fill(-1));
    const claimed = cats.map(([row, column], region) => {
      regions[row][column] = region;
      return [row, column, region];
    });
    let remaining = size ** 2 - cats.length;

    while (remaining > 0) {
      const expandable = claimed.filter(([row, column]) =>
        neighbors(row, column, size).some(
          ([targetRow, targetColumn]) => regions[targetRow][targetColumn] === -1
        )
      );
      const [row, column, region] = expandable[Math.floor(random() * expandable.length)];
      const available = neighbors(row, column, size).filter(
        ([targetRow, targetColumn]) => regions[targetRow][targetColumn] === -1
      );
      const [targetRow, targetColumn] = available[Math.floor(random() * available.length)];
      regions[targetRow][targetColumn] = region;
      claimed.push([targetRow, targetColumn, region]);
      remaining -= 1;
    }

    return regions;
  }

  function neighbors(row, column, size) {
    return [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([rowOffset, columnOffset]) => [row + rowOffset, column + columnOffset])
      .filter(([targetRow, targetColumn]) =>
        targetRow >= 0 && targetRow < size && targetColumn >= 0 && targetColumn < size
      );
  }

  function countSolutions(level, limit = Number.POSITIVE_INFINITY) {
    const usedColumns = new Set();
    const usedRegions = new Set();
    let solutionCount = 0;

    function search(row, previousColumn) {
      if (solutionCount >= limit) {
        return;
      }
      if (row === level.size) {
        solutionCount += 1;
        return;
      }
      for (let column = 0; column < level.size; column += 1) {
        const region = level.regions[row][column];
        if (
          usedColumns.has(column) ||
          usedRegions.has(region) ||
          (row > 0 && Math.abs(column - previousColumn) <= 1)
        ) {
          continue;
        }
        usedColumns.add(column);
        usedRegions.add(region);
        search(row + 1, column);
        usedColumns.delete(column);
        usedRegions.delete(region);
        if (solutionCount >= limit) {
          return;
        }
      }
    }

    search(0, -1);
    return solutionCount;
  }

  function generateLevel(options) {
    const {
      id,
      name,
      size,
      difficulty,
      seed,
      minScore = 0,
      maxScore = Number.POSITIVE_INFINITY,
      minBoardScore = 0,
      minLogicScore = 0,
      minSearchScore = 0,
      maxAttempts = 1000
    } = options;
    const random = createSeededRandom(seed);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const columns = generateCatColumns(size, random);
      if (!columns) {
        return null;
      }
      const cats = columns.map((column, row) => [row, column]);
      const level = {
        id,
        size,
        difficulty,
        name,
        regions: growConnectedRegions(size, cats, random),
        cats
      };
      if (countSolutions(level, 2) !== 1) {
        continue;
      }
      const analysis = analyzeLevel(level);
      if (
        analysis.solved &&
        analysis.score >= minScore &&
        analysis.score <= maxScore &&
        analysis.metrics.board.score >= minBoardScore &&
        analysis.metrics.logic.score >= minLogicScore &&
        analysis.metrics.search.score >= minSearchScore
      ) {
        return { level, analysis };
      }
    }

    return null;
  }

  return {
    createSeededRandom,
    generateCatColumns,
    growConnectedRegions,
    countSolutions,
    generateLevel
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_LEVEL_GENERATOR;
} else {
  globalThis.MEOWDOKU_LEVEL_GENERATOR = MEOWDOKU_LEVEL_GENERATOR;
}
