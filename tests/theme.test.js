"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const source = fs.readFileSync(require.resolve("../theme.js"), "utf8");
function start({ saved = null, dark = false, fail = false } = {}) {
  const events = {};
  const select = { value: "", addEventListener: (_, fn) => { events.select = fn; } };
  const warning = { hidden: true };
  const root = { dataset: {} };
  const media = { matches: dark, addEventListener: (_, fn) => { events.media = fn; } };
  const writes = [];
  vm.runInNewContext(source, {
    window: { matchMedia: () => media },
    document: { documentElement: root, addEventListener: (_, fn) => { events.ready = fn; },
      querySelector: (id) => id === "#themeSelect" ? select : warning },
    localStorage: { getItem: () => { if (fail) throw Error(); return saved; },
      setItem: (...args) => { if (fail) throw Error(); writes.push(args); } }
  });
  return { root, media, select, warning, writes, events };
}
test("初期描画前に端末テーマを適用し、変更にも追従する", () => {
  const app = start({ dark: true });
  assert.equal(app.root.dataset.theme, "dark");
  app.events.ready();
  assert.equal(app.select.value, "system");
  app.media.matches = false; app.events.media();
  assert.equal(app.root.dataset.theme, "light");
});
test("手動選択を別キーに保存し再起動後も端末設定より優先する", () => {
  const app = start(); app.events.ready();
  app.select.value = "dark"; app.events.select();
  assert.equal(app.root.dataset.theme, "dark");
  assert.deepEqual(app.writes, [["meowdoku-theme-v1", "dark"]]);
  app.events.media(); assert.equal(app.root.dataset.theme, "dark");
  assert.equal(start({ saved: app.writes[0][1] }).root.dataset.theme, "dark");
  app.select.value = "system"; app.events.select();
  assert.equal(app.root.dataset.theme, "light");
});
test("不正な保存値と保存失敗でも切替できる", () => {
  assert.equal(start({ saved: "invalid", dark: true }).root.dataset.theme, "dark");
  const app = start({ fail: true }); app.events.ready();
  app.select.value = "dark"; app.events.select();
  assert.equal(app.root.dataset.theme, "dark");
  assert.equal(app.warning.hidden, false);
});
