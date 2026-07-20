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

test("総合スコアが3軸の合計になる", () => {
  const result = analyzeLevel(levels[9]);
  assert.equal(
    result.score,
    result.metrics.board.score + result.metrics.logic.score + result.metrics.search.score
  );
});

test("盤面サイズとエリア形状を盤面負荷へ反映する", () => {
  const small = analyzeLevel(levels[0]);
  const large = analyzeLevel(levels[6]);
  assert.ok(large.metrics.board.score > small.metrics.board.score);

  const checkerboard = {
    ...levels[0],
    regions: Array.from({ length: 5 }, (_, row) =>
      Array.from({ length: 5 }, (_, column) => (row + column) % 5)
    )
  };
  assert.ok(
    analyzeLevel(checkerboard).metrics.board.irregularity > small.metrics.board.irregularity
  );
});

test("難しい必須解法と候補数を各軸へ反映する", () => {
  const introductory = analyzeLevel(levels[6]);
  const advanced = analyzeLevel(levels[8]);
  assert.equal(introductory.metrics.logic.hardestTechnique, "region-line");
  assert.equal(advanced.metrics.logic.hardestTechnique, "contradiction");
  assert.ok(
    advanced.metrics.search.averageCandidateCount >
    introductory.metrics.search.averageCandidateCount
  );
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
