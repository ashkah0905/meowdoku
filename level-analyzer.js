"use strict";

const MEOWDOKU_LEVEL_ANALYZER = (() => {
  const solver = typeof module !== "undefined" && module.exports
    ? require("./solver.js")
    : globalThis.MEOWDOKU_SOLVER;
  const rules = typeof module !== "undefined" && module.exports
    ? require("./rules.js")
    : globalThis.MEOWDOKU_RULES;

  const TECHNIQUE_WEIGHTS = {
    "placed-cat-crosses": 1,
    "single-candidate": 1,
    "region-line": 2,
    contradiction: 3
  };

  function getBoardMetrics(level) {
    let regionBoundaryCount = 0;
    for (let row = 0; row < level.size; row += 1) {
      for (let column = 0; column < level.size; column += 1) {
        if (column + 1 < level.size &&
          level.regions[row][column] !== level.regions[row][column + 1]) {
          regionBoundaryCount += 1;
        }
        if (row + 1 < level.size &&
          level.regions[row][column] !== level.regions[row + 1][column]) {
          regionBoundaryCount += 1;
        }
      }
    }
    const maximumBoundaries = 2 * level.size * (level.size - 1);
    const irregularity = regionBoundaryCount / maximumBoundaries;
    return {
      size: level.size,
      regionBoundaryCount,
      irregularity,
      score: level.size * 2 + Math.round(irregularity * 10)
    };
  }

  function buildResult(level, solved, steps, techniqueScore, techniques, candidateCounts) {
    const board = getBoardMetrics(level);
    const weights = Object.keys(techniques).map((technique) => TECHNIQUE_WEIGHTS[technique]);
    const hardestWeight = weights.length > 0 ? Math.max(...weights) : 0;
    const logic = {
      hardestTechnique: Object.keys(techniques).find(
        (technique) => TECHNIQUE_WEIGHTS[technique] === hardestWeight
      ) ?? null,
      techniqueVariety: weights.length,
      contradictionCount: techniques.contradiction ?? 0,
      score: techniqueScore + hardestWeight * 2 + weights.length
    };
    const totalCandidates = candidateCounts.reduce((sum, count) => sum + count, 0);
    const averageCandidateCount = candidateCounts.length > 0
      ? totalCandidates / candidateCounts.length
      : 0;
    const peakCandidateCount = candidateCounts.length > 0 ? Math.max(...candidateCounts) : 0;
    const search = {
      averageCandidateCount,
      peakCandidateCount,
      finalCandidateCount: candidateCounts.at(-1) ?? 0,
      score: Math.round(
        averageCandidateCount / level.size + peakCandidateCount / (level.size * 2)
      )
    };
    const metrics = { board, logic, search };
    return {
      solved,
      steps,
      score: board.score + logic.score + search.score,
      metrics,
      techniques
    };
  }

  function analyzeLevel(level) {
    const marks = Array(level.size ** 2).fill("empty");
    const cats = new Set(
      level.cats.map(([row, column]) => rules.toIndex(row, column, level.size))
    );
    const techniques = {};
    const candidateCounts = [];
    let steps = 0;
    let techniqueScore = 0;

    while (steps < level.size ** 2 * 4) {
      if ([...cats].every((index) => marks[index] === "cat")) {
        return buildResult(level, true, steps, techniqueScore, techniques, candidateCounts);
      }

      candidateCounts.push(solver.getLegalCandidateIndexes(level, marks).length);

      const hint = solver.findLogicHint(level, marks);
      if (!hint || !TECHNIQUE_WEIGHTS[hint.technique]) {
        break;
      }

      let targets;
      let mark;
      if (hint.technique === "single-candidate") {
        targets = hint.primary;
        mark = "cat";
      } else if (hint.technique === "contradiction") {
        targets = hint.primary;
        mark = "cross";
      } else {
        targets = hint.targets;
        mark = "cross";
      }

      const changed = targets.filter((index) => marks[index] === "empty");
      if (mark === "cat" && changed.some((index) => !cats.has(index))) {
        break;
      }
      if (changed.length === 0) {
        break;
      }
      for (const index of changed) {
        marks[index] = mark;
      }

      steps += 1;
      techniqueScore += TECHNIQUE_WEIGHTS[hint.technique];
      techniques[hint.technique] = (techniques[hint.technique] ?? 0) + 1;
    }

    return buildResult(level, false, steps, techniqueScore, techniques, candidateCounts);
  }

  return { analyzeLevel };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_LEVEL_ANALYZER;
} else {
  globalThis.MEOWDOKU_LEVEL_ANALYZER = MEOWDOKU_LEVEL_ANALYZER;
}
