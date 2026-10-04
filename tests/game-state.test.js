"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");
const {
  createGame,
  normalizeGame,
  loadGame,
  saveGame,
  findResumeLevelIndex
} = require("../game-state.js");

const options = {
  levels,
  cellCount: 25,
  maxLives: 3
};

function validGame() {
  return createGame(0, options);
}

test("新規ゲームを既定値で作成できる", () => {
  const game = validGame();
  assert.equal(game.levelIndex, 0);
  assert.equal(game.marks.length, 25);
  assert.deepEqual(game.memoMarks, Array(25).fill("empty"));
  assert.equal(game.memoMode, false);
  assert.equal(game.lives, 3);
  assert.equal(game.autoCross, true);
  assert.deepEqual(game.completedLevelIds, []);
});

test("正常な保存データを復元できる", () => {
  const saved = { ...validGame(), levelIndex: 1, lives: 2, autoCross: false };
  assert.deepEqual(normalizeGame(saved, options), saved);
});

test("JSONが壊れている場合は復元しない", () => {
  const storage = { getItem: () => "{" };
  assert.equal(loadGame(storage, "save", options), null);
});

test("不正なレベル番号を拒否する", () => {
  assert.equal(normalizeGame({ ...validGame(), levelIndex: 99 }, options), null);
});

test("不正なマーク値を拒否する", () => {
  const game = validGame();
  game.marks[0] = "invalid";
  assert.equal(normalizeGame(game, options), null);
});

test("範囲外のライフを拒否する", () => {
  assert.equal(normalizeGame({ ...validGame(), lives: -1 }, options), null);
  assert.equal(normalizeGame({ ...validGame(), lives: 4 }, options), null);
});

test("古い保存データでは自動入力をオンにする", () => {
  const game = validGame();
  delete game.autoCross;
  assert.equal(normalizeGame(game, options).autoCross, true);
});

test("古い保存データには空のメモ状態を補う", () => {
  const game = validGame();
  delete game.memoMarks;
  delete game.memoMode;
  const normalized = normalizeGame(game, options);
  assert.deepEqual(normalized.memoMarks, Array(25).fill("empty"));
  assert.equal(normalized.memoMode, false);
});

test("メモ状態を復元できる", () => {
  const game = validGame();
  game.memoMarks[0] = "cat";
  game.memoMarks[1] = "cross";
  game.memoMode = true;
  assert.deepEqual(normalizeGame(game, options), game);
});

test("不正なメモ状態を拒否する", () => {
  const invalidValue = validGame();
  invalidValue.memoMarks[0] = "wrong";
  assert.equal(normalizeGame(invalidValue, options), null);

  const invalidLength = validGame();
  invalidLength.memoMarks.pop();
  assert.equal(normalizeGame(invalidLength, options), null);
});

test("クリア済みレベルを保存データから復元できる", () => {
  const game = { ...validGame(), completedLevelIds: ["stage-001", "stage-003"] };
  assert.deepEqual(normalizeGame(game, options).completedLevelIds, ["stage-001", "stage-003"]);
});

test("クリア記録の重複と存在しないレベルを除去する", () => {
  const game = {
    ...validGame(),
    completedLevelIds: ["stage-001", "stage-001", "stage-003", "stage-999"]
  };
  assert.deepEqual(normalizeGame(game, options).completedLevelIds, ["stage-001", "stage-003"]);
});

test("添字形式のクリア記録をレベルIDへ移行する", () => {
  const game = { ...validGame(), completedLevels: [0, 2] };
  delete game.completedLevelIds;
  assert.deepEqual(normalizeGame(game, options).completedLevelIds, ["stage-001", "stage-003"]);
});

test("旧保存形式のクリア状態をクリア記録へ移行する", () => {
  const game = { ...validGame(), levelIndex: 1, completed: true };
  delete game.completedLevelIds;
  assert.deepEqual(normalizeGame(game, options).completedLevelIds, ["stage-002"]);
});

test("保存した状態を再読み込みできる", () => {
  const storage = {
    value: null,
    getItem() { return this.value; },
    setItem(key, value) { this.value = value; }
  };
  const game = { ...validGame(), lives: 1, autoCross: false };
  assert.equal(saveGame(storage, "save", game), true);
  assert.deepEqual(loadGame(storage, "save", options), game);
});

test("保存先の容量超過でも例外を投げず失敗を返す", () => {
  const game = validGame();
  const storage = { setItem() { throw new Error("QuotaExceededError"); } };
  assert.equal(saveGame(storage, "save", game), false);
  assert.deepEqual(game, validGame());
  assert.equal(saveGame(null, "save", game), false);
});

test("6x6レベルの36マスを復元できる", () => {
  const largeLevel = {
    id: "stage-007",
    size: 6,
    regions: Array.from({ length: 6 }, () => Array(6).fill(0)),
    cats: []
  };
  const largeOptions = { levels: [largeLevel], maxLives: 3 };
  const game = createGame(0, { size: largeLevel.size, maxLives: 3 });
  assert.equal(game.marks.length, 36);
  assert.deepEqual(normalizeGame(game, largeOptions), game);
});

test("空のクリア済み問題から最初の未クリア問題を再開する", () => {
  const game = validGame();
  game.completedLevelIds = ["stage-001", "stage-002", "stage-003"];
  assert.equal(findResumeLevelIndex(game, levels), 3);
});

test("プレイ途中の問題は再開位置を変えない", () => {
  const game = validGame();
  game.completedLevelIds = ["stage-001", "stage-002", "stage-003"];
  game.marks[0] = "cross";
  assert.equal(findResumeLevelIndex(game, levels), 0);
});
