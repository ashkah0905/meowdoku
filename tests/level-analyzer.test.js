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

test("6x6通常面が段階的に難しくなる", () => {
  const scores = levels.slice(6, 9).map((level) => analyzeLevel(level).score);
  assert.ok(scores[0] < scores[1]);
  assert.ok(scores[1] < scores[2]);
});

test("Super Hard面が直前の通常面より難しい", () => {
  const normal = analyzeLevel(levels[8]);
  const superHard = analyzeLevel(levels[9]);
  assert.ok(superHard.score > normal.score);
  assert.ok(superHard.techniques.contradiction >= 5);
});

test("ロジックで解けない盤面を未解決として返す", () => {
  const level = {
    size: 4,
    regions: Array.from({ length: 4 }, () => [0, 0, 0, 0]),
    cats: [[0, 0], [1, 2], [2, 0], [3, 2]]
  };
  assert.equal(analyzeLevel(level).solved, false);
});
