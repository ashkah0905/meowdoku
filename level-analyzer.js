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

  function analyzeLevel(level) {
    const marks = Array(level.size ** 2).fill("empty");
    const cats = new Set(
      level.cats.map(([row, column]) => rules.toIndex(row, column, level.size))
    );
    const techniques = {};
    let steps = 0;
    let score = 0;

    while (steps < level.size ** 2 * 4) {
      if ([...cats].every((index) => marks[index] === "cat")) {
        return { solved: true, steps, score, techniques };
      }

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
      score += TECHNIQUE_WEIGHTS[hint.technique];
      techniques[hint.technique] = (techniques[hint.technique] ?? 0) + 1;
    }

    return { solved: false, steps, score, techniques };
  }

  return { analyzeLevel };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_LEVEL_ANALYZER;
} else {
  globalThis.MEOWDOKU_LEVEL_ANALYZER = MEOWDOKU_LEVEL_ANALYZER;
}
