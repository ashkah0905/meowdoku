"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");
const {
  findLogicHint,
  findContradictionHint,
  buildAutoSolvePlan,
  getConflictingIndexes,
  getLegalCandidateIndexes
} = require("../solver.js");

const level = levels[0];

function emptyMarks() {
  return Array(level.size ** 2).fill("empty");
}

test("配置済みのネコから除外できるマスを示す", () => {
  const marks = emptyMarks();
  marks[1] = "cat";
  const hint = findLogicHint(level, marks);
  assert.deepEqual(hint.primary, [1]);
  assert.ok(hint.targets.includes(0));
  assert.ok(hint.targets.includes(6));
});

test("行の候補が一つならそのマスを示す", () => {
  const marks = emptyMarks();
  for (const index of [0, 2, 3, 4]) {
    marks[index] = "cross";
  }
  const hint = findLogicHint(level, marks);
  assert.deepEqual(hint.primary, [1]);
  assert.deepEqual(hint.targets, []);
});

test("仮置きで候補がなくなる矛盾を示す", () => {
  const marks = [
    "cross", "empty", "empty", "empty", "cross",
    "empty", "empty", "empty", "cross", "empty",
    "cross", "empty", "empty", "empty", "cross",
    "empty", "empty", "cross", "empty", "empty",
    "cross", "cross", "cross", "cross", "cross"
  ];
  const hint = findContradictionHint(level, marks);
  assert.deepEqual(hint.primary, [1]);
  assert.deepEqual(hint.targets, [20, 21, 22, 23, 24]);
});

test("残り一匹を自動解答プランにできる", () => {
  const marks = emptyMarks();
  for (const [row, column] of level.cats.slice(0, 4)) {
    marks[row * level.size + column] = "cat";
  }
  assert.deepEqual(buildAutoSolvePlan(level, marks), [23]);
});

test("絞り込めない盤面では自動解答しない", () => {
  assert.equal(buildAutoSolvePlan(level, emptyMarks()), null);
});

test("ヒントと自動解答は元の盤面を変更しない", () => {
  const marks = emptyMarks();
  marks[1] = "cat";
  const original = [...marks];
  findLogicHint(level, marks);
  buildAutoSolvePlan(level, marks);
  assert.deepEqual(marks, original);
});

test("競合するマスを重複なく返す", () => {
  const conflicts = getConflictingIndexes(level, 1);
  assert.equal(new Set(conflicts).size, conflicts.length);
  assert.ok(conflicts.includes(0));
  assert.ok(conflicts.includes(6));
  assert.ok(!conflicts.includes(1));
});

test("現在ネコを置ける候補マスを返す", () => {
  const marks = emptyMarks();
  assert.equal(getLegalCandidateIndexes(level, marks).length, level.size ** 2);
  marks[1] = "cat";
  assert.ok(getLegalCandidateIndexes(level, marks).length < level.size ** 2 - 1);
});

test("6x6でも配置済みのネコからヒントを作れる", () => {
  const largeLevel = {
    size: 6,
    regions: Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 6 }, (_, column) => (row + column) % 6)
    ),
    cats: []
  };
  const marks = Array(largeLevel.size ** 2).fill("empty");
  marks[0] = "cat";
  const hint = findLogicHint(largeLevel, marks);
  assert.deepEqual(hint.primary, [0]);
  assert.ok(hint.targets.includes(5));
  assert.ok(hint.targets.includes(30));
});
