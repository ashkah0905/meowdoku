"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");
const {
  createGame,
  normalizeGame,
  loadGame,
  saveGame
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
  assert.equal(game.lives, 3);
  assert.equal(game.autoCross, true);
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

test("保存した状態を再読み込みできる", () => {
  const storage = {
    value: null,
    getItem() { return this.value; },
    setItem(key, value) { this.value = value; }
  };
  const game = { ...validGame(), lives: 1, autoCross: false };
  saveGame(storage, "save", game);
  assert.deepEqual(loadGame(storage, "save", options), game);
});
