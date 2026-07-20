"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createSeededRandom,
  growConnectedRegions,
  countSolutions,
  generateLevel
} = require("../level-generator.js");

const options = {
  id: "generated-001",
  name: "生成問題",
  size: 5,
  difficulty: "normal",
  seed: 12345,
  minScore: 0,
  maxScore: 100,
  maxAttempts: 1000
};

function isRegionConnected(level, region) {
  const cells = [];
  for (let row = 0; row < level.size; row += 1) {
    for (let column = 0; column < level.size; column += 1) {
      if (level.regions[row][column] === region) {
        cells.push([row, column]);
      }
    }
  }
  const visited = new Set([cells[0].join(",")]);
  const queue = [cells[0]];
  while (queue.length > 0) {
    const [row, column] = queue.shift();
    for (const [rowOffset, columnOffset] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const targetRow = row + rowOffset;
      const targetColumn = column + columnOffset;
      const key = `${targetRow},${targetColumn}`;
      if (
        level.regions[targetRow]?.[targetColumn] === region &&
        !visited.has(key)
      ) {
        visited.add(key);
        queue.push([targetRow, targetColumn]);
      }
    }
  }
  return visited.size === cells.length;
}

test("同じseedから同じ問題を生成できる", () => {
  const first = generateLevel(options);
  const second = generateLevel(options);
  assert.ok(first);
  assert.deepEqual(second, first);
});

test("異なるseedでは異なる候補を生成する", () => {
  const first = generateLevel(options);
  const second = generateLevel({ ...options, seed: 54321 });
  assert.ok(first);
  assert.ok(second);
  assert.notDeepEqual(second.level.regions, first.level.regions);
});

test("生成問題がルールを満たす", () => {
  const { level, analysis } = generateLevel(options);
  assert.equal(new Set(level.cats.map(([row]) => row)).size, level.size);
  assert.equal(new Set(level.cats.map(([, column]) => column)).size, level.size);
  assert.equal(
    new Set(level.cats.map(([row, column]) => level.regions[row][column])).size,
    level.size
  );
  for (let row = 1; row < level.size; row += 1) {
    assert.ok(Math.abs(level.cats[row][1] - level.cats[row - 1][1]) > 1);
  }
  for (let region = 0; region < level.size; region += 1) {
    assert.equal(isRegionConnected(level, region), true);
  }
  assert.equal(countSolutions(level), 1);
  assert.equal(analysis.solved, true);
  assert.ok(analysis.score >= options.minScore && analysis.score <= options.maxScore);
});

test("連結した色エリアを生成する", () => {
  const cats = [[0, 1], [1, 3], [2, 0], [3, 2], [4, 4]];
  const level = {
    size: 5,
    regions: growConnectedRegions(5, cats, createSeededRandom(100))
  };
  for (let region = 0; region < level.size; region += 1) {
    assert.equal(isRegionConnected(level, region), true);
  }
});

test("条件を満たせない場合はnullを返す", () => {
  assert.equal(generateLevel({ ...options, minScore: 999, maxAttempts: 2 }), null);
});

test("軸ごとの最低スコアで候補を選別する", () => {
  const generated = generateLevel(options);
  assert.ok(generateLevel({
    ...options,
    minBoardScore: generated.analysis.metrics.board.score,
    minLogicScore: generated.analysis.metrics.logic.score,
    minSearchScore: generated.analysis.metrics.search.score
  }));
  assert.equal(generateLevel({ ...options, minBoardScore: 999, maxAttempts: 2 }), null);
  assert.equal(generateLevel({ ...options, minLogicScore: 999, maxAttempts: 2 }), null);
  assert.equal(generateLevel({ ...options, minSearchScore: 999, maxAttempts: 2 }), null);
});
