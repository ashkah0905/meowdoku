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
  assert.equal(toIndex(3, 2), 17);
  assert.deepEqual(toRowCol(17), [3, 2]);
});

test("マスが属する色を取得できる", () => {
  assert.equal(getRegion(level, toIndex(0, 4)), 1);
});

test("同じ行のネコを競合として判定する", () => {
  assert.equal(conflictsWithCat(level, toIndex(0, 0), toIndex(0, 4)), true);
});

test("同じ列のネコを競合として判定する", () => {
  assert.equal(conflictsWithCat(level, toIndex(0, 0), toIndex(4, 0)), true);
});

test("同じ色のネコを競合として判定する", () => {
  assert.equal(conflictsWithCat(level, toIndex(0, 0), toIndex(1, 2)), true);
});

test("斜めに隣接するネコを競合として判定する", () => {
  assert.equal(conflictsWithCat(level, toIndex(1, 4), toIndex(2, 3)), true);
});

test("離れた有効な配置は競合しない", () => {
  assert.equal(conflictsWithCat(level, toIndex(0, 1), toIndex(1, 4)), false);
});

test("競合するすべてのネコを問題箇所として返す", () => {
  const cats = [toIndex(0, 0), toIndex(0, 4), toIndex(4, 3)];
  assert.deepEqual(findRuleIssues(level, cats), [toIndex(0, 0), toIndex(0, 4)]);
});
