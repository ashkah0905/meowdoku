"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");
const {
  toIndex,
  toRowCol,
  getRegion,
  conflictsWithCat,
  findRuleIssues
} = require("../rules.js");

const level = levels[0];

test("座標とインデックスを相互変換できる", () => {
  assert.equal(toIndex(3, 2, level.size), 17);
  assert.deepEqual(toRowCol(17, level.size), [3, 2]);
});

test("マスが属する色を取得できる", () => {
  assert.equal(getRegion(level, toIndex(0, 4, level.size)), 1);
});

test("同じ行のネコを競合として判定する", () => {
  assert.equal(conflictsWithCat(level, toIndex(0, 0, level.size), toIndex(0, 4, level.size)), true);
});

test("同じ列のネコを競合として判定する", () => {
  assert.equal(conflictsWithCat(level, toIndex(0, 0, level.size), toIndex(4, 0, level.size)), true);
});

test("同じ色のネコを競合として判定する", () => {
  assert.equal(conflictsWithCat(level, toIndex(0, 0, level.size), toIndex(1, 2, level.size)), true);
});

test("斜めに隣接するネコを競合として判定する", () => {
  assert.equal(conflictsWithCat(level, toIndex(1, 4, level.size), toIndex(2, 3, level.size)), true);
});

test("離れた有効な配置は競合しない", () => {
  assert.equal(conflictsWithCat(level, toIndex(0, 1, level.size), toIndex(1, 4, level.size)), false);
});

test("競合するすべてのネコを問題箇所として返す", () => {
  const cats = [
    toIndex(0, 0, level.size),
    toIndex(0, 4, level.size),
    toIndex(4, 3, level.size)
  ];
  assert.deepEqual(findRuleIssues(level, cats), [
    toIndex(0, 0, level.size),
    toIndex(0, 4, level.size)
  ]);
});

test("6x6でも座標と競合を判定できる", () => {
  const largeLevel = {
    size: 6,
    regions: Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 6 }, (_, column) => (row + column) % 6)
    )
  };
  assert.equal(toIndex(5, 4, largeLevel.size), 34);
  assert.deepEqual(toRowCol(34, largeLevel.size), [5, 4]);
  assert.equal(conflictsWithCat(largeLevel, 0, 5), true);
});
