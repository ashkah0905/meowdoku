"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");
const { analyzeLevel } = require("../level-analyzer.js");

test("登録済みの全レベルを解析できる", () => {
  for (const level of levels) {
    const result = analyzeLevel(level);
    assert.equal(typeof result.solved, "boolean");
    assert.ok(Number.isInteger(result.steps));
    assert.ok(Number.isInteger(result.score));
    assert.equal(typeof result.techniques, "object");
  }
});

test("解析してもレベルデータを変更しない", () => {
  const before = JSON.stringify(levels[0]);
  analyzeLevel(levels[0]);
  assert.equal(JSON.stringify(levels[0]), before);
});

test("使用した解法を集計する", () => {
  const result = analyzeLevel(levels[6]);
  assert.equal(result.solved, true);
  assert.ok(result.steps > 0);
  assert.ok(result.techniques["single-candidate"] > 0);
});

test("ロジックで解けない盤面を未解決として返す", () => {
  const level = {
    size: 4,
    regions: Array.from({ length: 4 }, () => [0, 0, 0, 0]),
    cats: [[0, 0], [1, 2], [2, 0], [3, 2]]
  };
  assert.equal(analyzeLevel(level).solved, false);
});
