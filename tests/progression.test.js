"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getGenerationOptions } = require("../progression.js");

test("11面目でNormalへ戻る", () => {
  const options = getGenerationOptions(11);
  assert.equal(options.difficulty, "normal");
  assert.equal(options.minScore, 40);
  assert.equal(options.maxScore, 46);
});

test("5面ごとの特別ステージを設定する", () => {
  assert.equal(getGenerationOptions(15).difficulty, "hard");
  assert.equal(getGenerationOptions(20).difficulty, "super-hard");
  assert.equal(getGenerationOptions(21).difficulty, "normal");
});

test("30面目までは6x6で31面目から7x7になる", () => {
  assert.equal(getGenerationOptions(30).size, 6);
  assert.equal(getGenerationOptions(31).size, 7);
});

test("同じ面番号から同じIDとseedを作る", () => {
  const first = getGenerationOptions(11);
  const second = getGenerationOptions(11);
  assert.equal(first.id, "stage-011");
  assert.equal(first.seed, "meowdoku-v1:11");
  assert.equal(second.id, first.id);
  assert.equal(second.seed, first.seed);
});

test("周期前半の通常面が段階的に難しくなる", () => {
  const minimumScores = [11, 12, 13, 14].map(
    (levelNumber) => getGenerationOptions(levelNumber).minScore
  );
  assert.deepEqual(minimumScores, [40, 43, 46, 49]);
});

test("Hard後の通常面も段階的に難しくなる", () => {
  const minimumScores = [16, 17, 18, 19].map(
    (levelNumber) => getGenerationOptions(levelNumber).minScore
  );
  assert.deepEqual(minimumScores, [42, 46, 50, 54]);
});
