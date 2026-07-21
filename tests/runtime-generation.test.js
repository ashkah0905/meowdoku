"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generateLevel, countSolutions } = require("../level-generator.js");
const { getGenerationOptions } = require("../progression.js");
const {
  saveGeneratedLevel,
  findGeneratedLevel
} = require("../generated-level-store.js");

function createStorage() {
  return {
    value: null,
    getItem() { return this.value; },
    setItem(key, value) { this.value = value; }
  };
}

test("11面目を生成してキャッシュから再取得できる", () => {
  const options = getGenerationOptions(11);
  const first = generateLevel(options);
  const second = generateLevel(options);
  assert.ok(first);
  assert.deepEqual(second, first);
  assert.equal(countSolutions(first.level), 1);
  assert.ok(first.analysis.score >= options.minScore);
  assert.ok(first.analysis.score <= options.maxScore);

  const storage = createStorage();
  assert.equal(saveGeneratedLevel(storage, first.level), true);
  assert.deepEqual(findGeneratedLevel(storage, "stage-011"), first.level);
});

test("生成失敗をnullとして扱える", () => {
  const options = {
    ...getGenerationOptions(11),
    minScore: 999,
    maxAttempts: 1
  };
  assert.equal(generateLevel(options), null);
});

test("フォールバック生成でも同じ固定問題を保存できる", () => {
  const options = getGenerationOptions(11);
  const workerResult = generateLevel(options);
  const fallbackResult = generateLevel(options);
  assert.deepEqual(fallbackResult, workerResult);

  const storage = createStorage();
  assert.equal(saveGeneratedLevel(storage, fallbackResult.level), true);
  assert.deepEqual(findGeneratedLevel(storage, options.id), workerResult.level);
});

test("8x8問題を一意解で生成して保存できる", () => {
  const options = getGenerationOptions(51);
  const result = generateLevel(options);
  assert.ok(result);
  assert.equal(result.level.size, 8);
  assert.equal(result.level.cats.length, 8);
  assert.equal(new Set(result.level.regions.flat()).size, 8);
  assert.equal(countSolutions(result.level, 2), 1);

  const storage = createStorage();
  assert.equal(saveGeneratedLevel(storage, result.level), true);
  assert.deepEqual(findGeneratedLevel(storage, result.level.id), result.level);
});
