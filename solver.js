"use strict";

const MEOWDOKU_SOLVER = (() => {
  const rules = typeof module !== "undefined" && module.exports
    ? require("./rules.js")
    : globalThis.MEOWDOKU_RULES;
  const { SIZE, toIndex, toRowCol, getRegion, conflictsWithCat } = rules;
  const CELL_COUNT = SIZE * SIZE;
  const EMPTY = "empty";
  const CROSS = "cross";
  const CAT = "cat";

  function getPlacedCats(marks) {
    return marks
      .map((mark, index) => mark === CAT ? index : null)
      .filter((index) => index !== null);
  }

  function getEmptyIndexes(marks) {
    return marks
      .map((mark, index) => mark === EMPTY ? index : null)
      .filter((index) => index !== null);
  }

  function isLegalCandidate(level, marks, index, placedCats = getPlacedCats(marks)) {
    if (marks[index] === CROSS) {
      return false;
    }
    return placedCats.every((catIndex) =>
      catIndex === index || !conflictsWithCat(level, index, catIndex)
    );
  }

  function getUnitCandidates(level, marks, predicate) {
    return getEmptyIndexes(marks).filter((index) =>
      predicate(index) && isLegalCandidate(level, marks, index)
    );
  }

  function findCrossesFromPlacedCat(level, marks) {
    for (const catIndex of getPlacedCats(marks)) {
      const targets = getEmptyIndexes(marks).filter((index) =>
        conflictsWithCat(level, index, catIndex)
      );
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

  function findSingleCandidateHint(level, marks) {
    for (let row = 0; row < SIZE; row += 1) {
      const candidates = getUnitCandidates(level, marks, (index) => toRowCol(index)[0] === row);
      if (candidates.length === 1) {
        return {
          primary: candidates,
          targets: [],
          message: `${row + 1}行目でネコを置ける場所は、このマスだけです。`
        };
      }
    }

    for (let col = 0; col < SIZE; col += 1) {
      const candidates = getUnitCandidates(level, marks, (index) => toRowCol(index)[1] === col);
      if (candidates.length === 1) {
        return {
          primary: candidates,
          targets: [],
          message: `${col + 1}列目でネコを置ける場所は、このマスだけです。`
        };
      }
    }

    for (let region = 0; region < SIZE; region += 1) {
      const candidates = getUnitCandidates(
        level,
        marks,
        (index) => getRegion(level, index) === region
      );
      if (candidates.length === 1) {
        return {
          primary: candidates,
          targets: [],
          message: "この色でネコを置ける場所は、このマスだけです。"
        };
      }
    }

    return null;
  }

  function findRegionLineHint(level, marks) {
    for (let region = 0; region < SIZE; region += 1) {
      const candidates = getUnitCandidates(
        level,
        marks,
        (index) => getRegion(level, index) === region
      );
      if (candidates.length <= 1) {
        continue;
      }

      const rows = new Set(candidates.map((index) => toRowCol(index)[0]));
      if (rows.size === 1) {
        const row = [...rows][0];
        const targets = getEmptyIndexes(marks).filter((index) => {
          const [targetRow] = toRowCol(index);
          return targetRow === row &&
            getRegion(level, index) !== region &&
            isLegalCandidate(level, marks, index);
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
        const targets = getEmptyIndexes(marks).filter((index) => {
          const [, targetCol] = toRowCol(index);
          return targetCol === col &&
            getRegion(level, index) !== region &&
            isLegalCandidate(level, marks, index);
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

  function indexesInRow(row) {
    return Array.from({ length: SIZE }, (_, col) => toIndex(row, col));
  }

  function indexesInCol(col) {
    return Array.from({ length: SIZE }, (_, row) => toIndex(row, col));
  }

  function indexesInRegion(level, region) {
    const indexes = [];
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (getRegion(level, index) === region) {
        indexes.push(index);
      }
    }
    return indexes;
  }

  function findContradictionAfterCat(level, marks, index) {
    const simulatedCats = [...getPlacedCats(marks), index];

    for (let row = 0; row < SIZE; row += 1) {
      if (simulatedCats.some((catIndex) => toRowCol(catIndex)[0] === row)) {
        continue;
      }
      const targets = getEmptyIndexes(marks).filter((candidate) =>
        toRowCol(candidate)[0] === row &&
        isLegalCandidate(level, marks, candidate, simulatedCats)
      );
      if (targets.length === 0) {
        return { label: `${row + 1}行目`, targets: indexesInRow(row) };
      }
    }

    for (let col = 0; col < SIZE; col += 1) {
      if (simulatedCats.some((catIndex) => toRowCol(catIndex)[1] === col)) {
        continue;
      }
      const targets = getEmptyIndexes(marks).filter((candidate) =>
        toRowCol(candidate)[1] === col &&
        isLegalCandidate(level, marks, candidate, simulatedCats)
      );
      if (targets.length === 0) {
        return { label: `${col + 1}列目`, targets: indexesInCol(col) };
      }
    }

    for (let region = 0; region < SIZE; region += 1) {
      if (simulatedCats.some((catIndex) => getRegion(level, catIndex) === region)) {
        continue;
      }
      const targets = getEmptyIndexes(marks).filter((candidate) =>
        getRegion(level, candidate) === region &&
        isLegalCandidate(level, marks, candidate, simulatedCats)
      );
      if (targets.length === 0) {
        return { label: "同じ色のエリア", targets: indexesInRegion(level, region) };
      }
    }

    return null;
  }

  function findContradictionHint(level, marks) {
    for (const index of getEmptyIndexes(marks)) {
      if (!isLegalCandidate(level, marks, index)) {
        continue;
      }
      const contradiction = findContradictionAfterCat(level, marks, index);
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

  function findLogicHint(level, marks) {
    return findCrossesFromPlacedCat(level, marks) ||
      findSingleCandidateHint(level, marks) ||
      findRegionLineHint(level, marks) ||
      findContradictionHint(level, marks);
  }

  function getConflictingIndexes(level, index) {
    const indexes = [];
    for (let target = 0; target < CELL_COUNT; target += 1) {
      if (target !== index && conflictsWithCat(level, target, index)) {
        indexes.push(target);
      }
    }
    return indexes;
  }

  function isWorkingLegalCandidate(level, working, index) {
    if (working[index] !== EMPTY) {
      return false;
    }
    const placedCats = getPlacedCats(working);
    return placedCats.every((catIndex) => !conflictsWithCat(level, index, catIndex));
  }

  function getWorkingUnitCandidates(level, working, predicate) {
    return working
      .map((mark, index) =>
        mark === EMPTY && predicate(index) && isWorkingLegalCandidate(level, working, index)
          ? index
          : null
      )
      .filter((index) => index !== null);
  }

  function findWorkingSingleCandidate(level, working) {
    for (let row = 0; row < SIZE; row += 1) {
      const candidates = getWorkingUnitCandidates(
        level,
        working,
        (index) => toRowCol(index)[0] === row
      );
      if (candidates.length === 1) {
        return candidates[0];
      }
    }

    for (let col = 0; col < SIZE; col += 1) {
      const candidates = getWorkingUnitCandidates(
        level,
        working,
        (index) => toRowCol(index)[1] === col
      );
      if (candidates.length === 1) {
        return candidates[0];
      }
    }

    for (let region = 0; region < SIZE; region += 1) {
      const candidates = getWorkingUnitCandidates(
        level,
        working,
        (index) => getRegion(level, index) === region
      );
      if (candidates.length === 1) {
        return candidates[0];
      }
    }

    return null;
  }

  function buildAutoSolvePlan(level, marks) {
    const cats = new Set(level.cats.map(([row, col]) => toIndex(row, col)));
    const working = [...marks];
    const additions = [];
    let changed = true;

    while (changed) {
      changed = false;
      for (let index = 0; index < CELL_COUNT; index += 1) {
        if (working[index] === CAT) {
          for (const target of getConflictingIndexes(level, index)) {
            if (working[target] === EMPTY) {
              working[target] = CROSS;
              changed = true;
            }
          }
        }
      }

      const single = findWorkingSingleCandidate(level, working);
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

  return {
    findLogicHint,
    findContradictionHint,
    buildAutoSolvePlan,
    getConflictingIndexes
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_SOLVER;
} else {
  globalThis.MEOWDOKU_SOLVER = MEOWDOKU_SOLVER;
}
