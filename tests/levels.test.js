"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");

const SIZE = 5;

test("固定問題が6問登録されている", () => {
  assert.equal(levels.length, 6);
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
  for (let rowA = 0; rowA < SIZE; rowA += 1) {
    for (let rowB = rowA + 1; rowB < SIZE; rowB += 1) {
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
  return permutations([0, 1, 2, 3, 4]).filter((columns) => {
    const regions = columns.map((column, row) => level.regions[row][column]);
    return new Set(regions).size === SIZE && isNonAdjacent(columns);
  });
}

for (const level of levels) {
  test(`${level.name} の形式と一意解が正しい`, () => {
    assert.equal(level.regions.length, SIZE);
    for (const row of level.regions) {
      assert.equal(row.length, SIZE);
    }

    const regionIds = new Set(level.regions.flat());
    assert.deepEqual([...regionIds].sort(), [0, 1, 2, 3, 4]);

    assert.equal(level.cats.length, SIZE);
    assert.equal(new Set(level.cats.map(([row]) => row)).size, SIZE);
    assert.equal(new Set(level.cats.map(([, column]) => column)).size, SIZE);
    assert.equal(
      new Set(level.cats.map(([row, column]) => level.regions[row][column])).size,
      SIZE
    );

    const registeredColumns = Array(SIZE);
    for (const [row, column] of level.cats) {
      assert.ok(row >= 0 && row < SIZE);
      assert.ok(column >= 0 && column < SIZE);
      registeredColumns[row] = column;
    }
    assert.equal(isNonAdjacent(registeredColumns), true);

    const solutions = findSolutions(level);
    assert.equal(solutions.length, 1);
    assert.deepEqual(solutions[0], registeredColumns);
  });
}
