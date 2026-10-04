"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");
const { createGame } = require("../game-state.js");
const { createApp } = require("./helpers/main-harness.cjs");

function completedGame(levelIndex = 0) {
  const level = levels[levelIndex];
  const state = createGame(levelIndex, { size: level.size, maxLives: 3 });
  for (const [row, column] of level.cats) state.marks[row * level.size + column] = "cat";
  state.completed = true;
  state.completedLevelIds = [level.id];
  return state;
}

test("クリア済み盤面を再読み込みして次の問題へ進める", async () => {
  const app = createApp({ savedState: completedGame() });
  app.get("continueBtn").dispatch("click");
  assert.equal(app.get("nextLevelBtn").hidden, false);
  await app.get("nextLevelBtn").dispatch("click");
  assert.equal(app.run("getLevel().id"), "stage-002");
  assert.equal(app.run("state.completed"), false);
  assert.equal(app.get("nextLevelBtn").hidden, true);
  assert.deepEqual(Array.from(app.run("state.completedLevelIds")), ["stage-001"]);
});

for (const dismissal of ["backdrop", "Escape"]) {
  test(`クリアダイアログを${dismissal}で閉じても次へ進める`, async () => {
    const app = createApp();
    app.get("continueBtn").dispatch("click");
    for (const [row, column] of levels[0].cats) app.run(`placeCat(${row * 5 + column})`);
    assert.equal(app.get("resultDialog").classList.contains("open"), true);
    if (dismissal === "Escape") app.document.dispatch("keydown", { key: "Escape" });
    else app.get("resultDialog").querySelector(".dialog-backdrop").dispatch("click");
    assert.equal(app.get("resultDialog").classList.contains("open"), false);
    assert.equal(app.get("nextLevelBtn").hidden, false);
    await app.get("nextLevelBtn").dispatch("click");
    assert.equal(app.run("getLevel().id"), "stage-002");
  });
}

test("リセット後には次の問題ボタンを表示しない", () => {
  const app = createApp({ savedState: completedGame() });
  app.get("continueBtn").dispatch("click");
  app.get("resetBtn").dispatch("click");
  assert.equal(app.get("nextLevelBtn").hidden, true);
});

test("保存失敗時も盤面操作とリセットを続けられ警告を表示する", () => {
  const app = createApp({ failWrites: true });
  app.get("continueBtn").dispatch("click");
  app.run("toggleCross(0)");
  assert.equal(app.run("state.marks[0]"), "cross");
  assert.equal(app.get("saveWarning").hidden, false);
  app.get("resetBtn").dispatch("click");
  assert.equal(app.run("state.marks[0]"), "empty");
});

test("localStorageへのアクセス自体が拒否されても起動して遊べる", () => {
  const app = createApp({ denyStorage: true });
  app.get("continueBtn").dispatch("click");
  app.run("toggleCross(0)");
  assert.equal(app.run("state.marks[0]"), "cross");
  assert.equal(app.get("saveWarning").hidden, false);
});

test("正常に保存できるときは警告を表示しない", () => {
  const app = createApp();
  app.get("continueBtn").dispatch("click");
  app.run("toggleCross(0)");
  assert.equal(app.get("saveWarning").hidden, true);
  assert.equal(JSON.parse(app.storage.getItem("meowdoku-logic-v1")).marks[0], "cross");
});

test("Worker生成問題の保存に失敗しても次へ進み待機状態を解除する", async () => {
  const app = createApp({ savedState: completedGame(9), failWrites: true });
  app.get("continueBtn").dispatch("click");
  const transition = app.get("nextLevelBtn").dispatch("click");
  assert.equal(app.get("nextLevelBtn").disabled, true);
  const { requestId } = app.worker.messages.find((request) => request.levelNumber === 11);
  const level = { ...structuredClone(levels[6]), id: "stage-011", name: "レベル 11" };
  app.worker.dispatch("message", { data: { requestId, level } });
  await transition;
  assert.equal(app.run("getLevel().id"), "stage-011");
  assert.equal(app.run("isChangingLevel"), false);
  assert.equal(app.run("pendingGeneration.has(11)"), false);
  assert.equal(app.get("closeDialogBtn").disabled, false);
  assert.equal(app.get("nextLevelBtn").disabled, false);
  assert.equal(app.get("saveWarning").hidden, false);
  assert.equal(app.storage.getItem("meowdoku-generated-levels-v1"), null);
});

for (const workerAvailable of [false, true]) {
  test(`${workerAvailable ? "Workerエラー後" : "Workerなし"}の生成でも保存失敗後に問題を利用できる`, async () => {
    const app = createApp({ savedState: completedGame(9), failWrites: true, workerAvailable });
    const generated = { ...structuredClone(levels[6]), id: "stage-011", name: "レベル 11" };
    app.context.testLevel = generated;
    app.run("MEOWDOKU_LEVEL_GENERATOR.generateLevel = () => ({ level: testLevel })");
    app.get("continueBtn").dispatch("click");
    const transition = app.get("nextLevelBtn").dispatch("click");
    if (workerAvailable) app.worker.dispatch("error");
    app.runTimers(0);
    await transition;
    assert.equal(app.run("getLevel().id"), "stage-011");
    assert.equal(app.run("isChangingLevel"), false);
    assert.equal(app.run("pendingGeneration.has(11)"), false);
    assert.equal(app.get("saveWarning").hidden, false);
  });
}
