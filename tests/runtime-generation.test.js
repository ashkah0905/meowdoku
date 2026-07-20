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
