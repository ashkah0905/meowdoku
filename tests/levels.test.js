"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");

test("固定問題が10問登録されている", () => {
  assert.equal(levels.length, 10);
});

function permutations(values) {
  if (values.length < 2) {
    return [values];
  }

  return values.flatMap((value, index) => {
    const remaining = [...values.slice(0, index), ...values.slice(index + 1)];
    return permutations(remaining).map((permutation) => [value, ...permutation]);
  });
}

function isNonAdjacent(columns) {
  for (let rowA = 0; rowA < columns.length; rowA += 1) {
    for (let rowB = rowA + 1; rowB < columns.length; rowB += 1) {
      const neighboringRows = Math.abs(rowA - rowB) <= 1;
      const neighboringColumns = Math.abs(columns[rowA] - columns[rowB]) <= 1;
      if (neighboringRows && neighboringColumns) {
        return false;
      }
    }
  }
  return true;
}

function findSolutions(level) {
  return permutations(Array.from({ length: level.size }, (_, index) => index)).filter((columns) => {
    const regions = columns.map((column, row) => level.regions[row][column]);
    return new Set(regions).size === level.size && isNonAdjacent(columns);
  });
}

test("レベルIDが一意でメタデータが正しい", () => {
  assert.equal(new Set(levels.map((level) => level.id)).size, levels.length);
  for (const level of levels) {
    assert.match(level.id, /^stage-\d{3}$/);
    assert.ok(["normal", "hard", "super-hard"].includes(level.difficulty));
  }
});

test("5面目がHardとして登録されている", () => {
  assert.equal(levels[4].difficulty, "hard");
});

test("10面目がSuper Hardとして登録されている", () => {
  assert.equal(levels[9].difficulty, "super-hard");
});

for (const level of levels) {
  test(`${level.name} の形式と一意解が正しい`, () => {
    const size = level.size;
    assert.equal(level.regions.length, size);
    for (const row of level.regions) {
      assert.equal(row.length, size);
    }

    const regionIds = new Set(level.regions.flat());
    assert.deepEqual([...regionIds].sort(), Array.from({ length: size }, (_, index) => index));

    assert.equal(level.cats.length, size);
    assert.equal(new Set(level.cats.map(([row]) => row)).size, size);
    assert.equal(new Set(level.cats.map(([, column]) => column)).size, size);
    assert.equal(
      new Set(level.cats.map(([row, column]) => level.regions[row][column])).size,
      size
    );

    const registeredColumns = Array(size);
    for (const [row, column] of level.cats) {
      assert.ok(row >= 0 && row < size);
      assert.ok(column >= 0 && column < size);
      registeredColumns[row] = column;
    }
    assert.equal(isNonAdjacent(registeredColumns), true);

    const solutions = findSolutions(level);
    assert.equal(solutions.length, 1);
    assert.deepEqual(solutions[0], registeredColumns);
  });
}
