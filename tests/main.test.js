"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");
const { createGame } = require("../game-state.js");
const { createApp } = require("./helpers/main-harness.cjs");

const flushTasks = () => new Promise((resolve) => setImmediate(resolve));

async function finishTransition(app) {
  app.runTimers(100);
  await flushTasks();
  app.runTimers(0);
  await flushTasks();
  app.runTimers(700);
  await flushTasks();
  app.runTimers(200);
  await flushTasks();
  app.runTimers(100);
  await flushTasks();
}

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
  const transition = app.get("nextLevelBtn").dispatch("click");
  await finishTransition(app);
  await transition;
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
    const transition = app.get("nextLevelBtn").dispatch("click");
    await finishTransition(app);
    await transition;
    assert.equal(app.run("getLevel().id"), "stage-002");
  });
}

test("リセット後には次の問題ボタンを表示しない", () => {
  const app = createApp({ savedState: completedGame() });
  app.get("continueBtn").dispatch("click");
  app.get("resetBtn").dispatch("click");
  assert.equal(app.get("nextLevelBtn").hidden, true);
});

function pressCat(app, index, overrides = {}) {
  const cell = app.get("board").children[index];
  cell.focus();
  app.get("board").dispatch("keydown", { key: "c", target: cell, preventDefault() {}, ...overrides });
}

test("キーボードでネコを置き再描画後も操作したマスにフォーカスを保つ", () => {
  const app = createApp();
  app.get("continueBtn").dispatch("click");
  const [row, column] = levels[0].cats[0];
  const index = row * 5 + column;
  pressCat(app, index);
  assert.equal(app.run(`state.marks[${index}]`), "cat");
  assert.equal(app.document.activeElement, app.get("board").children[index]);
  const emptyCell = app.get("board").children.find((cell) => app.run(`state.marks[${cell.dataset.index}]`) === "cross");
  emptyCell.focus();
  app.get("board").dispatch("click", { target: emptyCell });
  assert.equal(app.document.activeElement, app.get("board").children[Number(emptyCell.dataset.index)]);
});

test("キーボードだけでクリアしダイアログへフォーカスを移せる", () => {
  const app = createApp();
  app.get("continueBtn").dispatch("click");
  for (const [row, column] of levels[0].cats) pressCat(app, row * 5 + column);
  assert.equal(app.run("state.completed"), true);
  assert.equal(app.document.activeElement, app.get("closeDialogBtn"));
});

test("メモモードではCで仮のネコを切り替えライフを減らさない", () => {
  const app = createApp();
  app.get("continueBtn").dispatch("click");
  app.get("memoBtn").dispatch("click");
  pressCat(app, 0);
  assert.equal(app.run("state.memoMarks[0]"), "cat");
  assert.equal(app.run("state.marks[0]"), "empty");
  pressCat(app, 0);
  assert.equal(app.run("state.memoMarks[0]"), "empty");
  assert.equal(app.run("state.lives"), 3);
});

test("キーリピート・修飾キー・操作不可の盤面ではネコを置かない", () => {
  const app = createApp();
  app.get("continueBtn").dispatch("click");
  for (const overrides of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }]) pressCat(app, 0, overrides);
  assert.equal(app.run("state.marks[0]"), "empty");
  for (const condition of ["state.completed = true", "state.lives = 0", "isAutoSolving = true"]) {
    app.run("state.completed = false; state.lives = 3; isAutoSolving = false;");
    app.run(condition);
    pressCat(app, 0);
    assert.equal(app.run("state.marks[0]"), "empty");
  }
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
  await finishTransition(app);
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
    await finishTransition(app);
    await transition;
    assert.equal(app.run("getLevel().id"), "stage-011");
    assert.equal(app.run("isChangingLevel"), false);
    assert.equal(app.run("pendingGeneration.has(11)"), false);
    assert.equal(app.get("saveWarning").hidden, false);
  });
}

test("表示だけの更新は保存せず盤面・メモ・設定の変更を保存する", () => {
  const app = createApp();
  const key = "meowdoku-logic-v1";
  app.get("continueBtn").dispatch("click");
  app.run("render()");
  app.get("homeBtn").dispatch("click");
  app.get("continueBtn").dispatch("click");
  assert.equal(app.writes(key), 0);
  app.run("toggleCross(0)");
  assert.equal(app.writes(key), 1);
  app.get("memoBtn").dispatch("click");
  assert.equal(JSON.parse(app.storage.getItem(key)).memoMode, true);
  pressCat(app, 2);
  assert.equal(JSON.parse(app.storage.getItem(key)).memoMarks[2], "cat");
  app.get("resetMemoBtn").dispatch("click");
  assert.equal(JSON.parse(app.storage.getItem(key)).memoMarks[2], "empty");
  const beforeSetting = app.writes(key);
  app.get("autoCrossToggle").checked = false;
  app.get("autoCrossToggle").dispatch("change");
  assert.equal(app.writes(key), beforeSetting + 1);
  assert.equal(JSON.parse(app.storage.getItem(key)).autoCross, false);
});

test("仕上げたクリア状態を保存し再読み込み後も次へ進める", async () => {
  const app = createApp();
  app.get("continueBtn").dispatch("click");
  for (const [row, column] of levels[0].cats.slice(0, 4)) pressCat(app, row * 5 + column);
  app.get("autoSolveBtn").dispatch("click");
  app.runTimers(650);
  const savedState = JSON.parse(app.storage.getItem("meowdoku-logic-v1"));
  assert.equal(savedState.completed, true);
  const reloaded = createApp({ savedState });
  reloaded.get("continueBtn").dispatch("click");
  const transition = reloaded.get("nextLevelBtn").dispatch("click");
  await finishTransition(reloaded);
  await transition;
  assert.equal(JSON.parse(reloaded.storage.getItem("meowdoku-logic-v1")).levelIndex, 1);
});

test("中断されたドラッグで入力済みの印も保存する", () => {
  const app = createApp();
  app.get("continueBtn").dispatch("click");
  app.run("state.marks[0] = 'cross'; crossDrag = { pointerId: 1, touched: new Set([0]), longPressTimer: null }");
  app.get("board").dispatch("pointercancel", { type: "pointercancel", pointerId: 1 });
  assert.equal(JSON.parse(app.storage.getItem("meowdoku-logic-v1")).marks[0], "cross");
});

test("次の問題名を表示し最短1100msの遷移後に新しい盤面へフォーカスする", async () => {
  const app = createApp({ savedState: completedGame() });
  app.get("continueBtn").dispatch("click");
  const transition = app.get("nextLevelBtn").dispatch("click");
  assert.equal(app.get("transitionLevelTitle").textContent, "レベル 2");
  assert.equal(app.get("levelTransition").hidden, false);
  assert.equal(app.get("gameScreen").inert, true);
  assert.equal(app.document.activeElement, app.get("levelTransition"));
  assert.equal(app.run("getLevel().id"), "stage-001");
  app.runTimers(100);
  await flushTasks();
  assert.equal(app.run("getLevel().id"), "stage-001");
  app.runTimers(700);
  await flushTasks();
  assert.equal(app.run("getLevel().id"), "stage-001");
  assert.equal(app.get("levelTransition").classList.contains("level-ready"), true);
  assert.equal(app.get("transitionProgress").attributes["aria-valuetext"], "準備完了");
  app.runTimers(200);
  await flushTasks();
  assert.equal(app.run("getLevel().id"), "stage-002");
  assert.equal(app.get("levelTransition").hidden, false);
  assert.equal(app.get("levelTransition").classList.contains("level-arriving"), true);
  app.runTimers(100);
  await transition;
  assert.equal(app.get("levelTransition").hidden, true);
  assert.equal(app.get("levelTransition").classList.contains("level-ready"), false);
  assert.equal(app.get("levelTransition").classList.contains("level-preparing"), false);
  assert.equal(app.get("gameScreen").inert, false);
  assert.equal(app.get("gameScreen").attributes["aria-busy"], "false");
  assert.equal(app.document.activeElement, app.get("board").children[0]);
});

test("クリアダイアログのつづけるでも遷移画面を挟む", async () => {
  const app = createApp();
  app.get("continueBtn").dispatch("click");
  for (const [row, column] of levels[0].cats) pressCat(app, row * 5 + column);
  const transition = app.get("closeDialogBtn").dispatch("click");
  assert.equal(app.get("resultDialog").classList.contains("open"), false);
  assert.equal(app.get("levelTransition").hidden, false);
  assert.equal(app.run("getLevel().id"), "stage-001");
  await finishTransition(app);
  await transition;
  assert.equal(app.run("getLevel().id"), "stage-002");
});

test("生成が遅い場合は遷移画面を表示し続けてから盤面へ進む", async () => {
  const app = createApp({ savedState: completedGame(9) });
  app.get("continueBtn").dispatch("click");
  const transition = app.get("nextLevelBtn").dispatch("click");
  app.runTimers(100);
  await flushTasks();
  app.runTimers(700);
  await flushTasks();
  assert.equal(app.get("levelTransition").hidden, false);
  assert.equal(app.get("levelTransition").classList.contains("level-preparing"), true);
  assert.equal(app.get("levelTransition").classList.contains("level-ready"), false);
  assert.equal(app.get("transitionProgress").attributes["aria-valuetext"], "次の問題を準備中");
  assert.equal(app.run("getLevel().id"), "stage-010");
  const { requestId } = app.worker.messages.find((request) => request.levelNumber === 11);
  const level = { ...structuredClone(levels[6]), id: "stage-011", name: "レベル 11" };
  app.worker.dispatch("message", { data: { requestId, level } });
  await flushTasks();
  assert.equal(app.get("levelTransition").classList.contains("level-ready"), true);
  assert.equal(app.get("transitionProgress").attributes["aria-valuetext"], "準備完了");
  app.runTimers(200);
  await flushTasks();
  assert.equal(app.get("levelTransition").classList.contains("level-arriving"), true);
  app.runTimers(100);
  await transition;
  assert.equal(app.run("getLevel().id"), "stage-011");
  assert.equal(app.get("levelTransition").hidden, true);
});

test("生成失敗時は元の盤面へ戻して再試行できる", async () => {
  const app = createApp({ savedState: completedGame(9) });
  app.get("continueBtn").dispatch("click");
  const transition = app.get("nextLevelBtn").dispatch("click");
  app.runTimers(100);
  await flushTasks();
  const { requestId } = app.worker.messages.find((request) => request.levelNumber === 11);
  app.worker.dispatch("message", { data: { requestId, level: null } });
  await finishTransition(app);
  await transition;
  assert.equal(app.run("getLevel().id"), "stage-010");
  assert.equal(app.run("isChangingLevel"), false);
  assert.equal(app.get("levelTransition").hidden, true);
  assert.equal(app.get("gameScreen").inert, false);
  assert.equal(app.get("nextLevelBtn").disabled, false);
  assert.equal(app.document.activeElement, app.get("nextLevelBtn"));
  const retry = app.get("nextLevelBtn").dispatch("click");
  app.runTimers(100);
  await flushTasks();
  const retryRequest = app.worker.messages.filter((request) => request.levelNumber === 11).at(-1);
  assert.notEqual(retryRequest.requestId, requestId);
  app.worker.dispatch("message", { data: { requestId: retryRequest.requestId, level: null } });
  await finishTransition(app);
  await retry;
});

test("遷移中の連打やキーボード操作で盤面と保存データを変更しない", async () => {
  const app = createApp({ savedState: completedGame() });
  app.get("continueBtn").dispatch("click");
  const savedBefore = app.storage.getItem("meowdoku-logic-v1");
  const transition = app.get("nextLevelBtn").dispatch("click");
  await app.get("nextLevelBtn").dispatch("click");
  app.document.dispatch("keydown", { key: "r" });
  app.document.dispatch("keydown", { key: "h" });
  app.run("toggleCross(0); placeCat(0)");
  assert.equal(app.run("state.completed"), true);
  assert.equal(app.storage.getItem("meowdoku-logic-v1"), savedBefore);
  await finishTransition(app);
  await transition;
  assert.equal(app.run("getLevel().id"), "stage-002");
});
