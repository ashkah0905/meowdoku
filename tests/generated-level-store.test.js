"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const levels = require("../levels.js");
const {
  STORAGE_KEY,
  isValidGeneratedLevel,
  loadGeneratedLevels,
  findGeneratedLevel,
  saveGeneratedLevel,
  removeInvalidGeneratedLevels
} = require("../generated-level-store.js");

function createStorage() {
  return {
    value: null,
    getItem() { return this.value; },
    setItem(key, value) {
      assert.equal(key, STORAGE_KEY);
      this.value = value;
    }
  };
}

function generatedLevel(id = "stage-011") {
  return {
    ...structuredClone(levels[6]),
    id,
    name: `レベル ${Number(id.slice(6))}`
  };
}

test("生成問題を保存して再取得できる", () => {
  const storage = createStorage();
  const level = generatedLevel();
  assert.equal(saveGeneratedLevel(storage, level), true);
  assert.deepEqual(findGeneratedLevel(storage, level.id), level);
});

test("複数問題を保持して同じIDを重複保存しない", () => {
  const storage = createStorage();
  saveGeneratedLevel(storage, generatedLevel("stage-011"));
  saveGeneratedLevel(storage, generatedLevel("stage-012"));
  saveGeneratedLevel(storage, { ...generatedLevel("stage-011"), name: "更新済み" });
  const saved = loadGeneratedLevels(storage);
  assert.equal(saved.length, 2);
  assert.equal(saved.find((level) => level.id === "stage-011").name, "更新済み");
});

test("JSON破損時は空として扱う", () => {
  const storage = createStorage();
  storage.value = "{";
  assert.deepEqual(loadGeneratedLevels(storage), []);
});

test("異なる生成バージョンは再利用しない", () => {
  const storage = createStorage();
  storage.value = JSON.stringify({ generatorVersion: 0, levels: [generatedLevel()] });
  assert.deepEqual(loadGeneratedLevels(storage), []);
});

test("不正な問題データを除外する", () => {
  const storage = createStorage();
  const invalid = { ...generatedLevel(), size: 8 };
  storage.value = JSON.stringify({ generatorVersion: 1, levels: [generatedLevel(), invalid] });
  assert.equal(removeInvalidGeneratedLevels(storage).length, 1);
  assert.equal(JSON.parse(storage.value).levels.length, 1);
});

test("保存と読み込みで元データを変更しない", () => {
  const storage = createStorage();
  const level = generatedLevel();
  saveGeneratedLevel(storage, level);
  const loaded = loadGeneratedLevels(storage);
  loaded[0].regions[0][0] = 99;
  assert.notEqual(level.regions[0][0], 99);
  assert.notEqual(loadGeneratedLevels(storage)[0].regions[0][0], 99);
});

test("不正な問題は保存しない", () => {
  const storage = createStorage();
  assert.equal(saveGeneratedLevel(storage, { ...generatedLevel(), cats: [] }), false);
  assert.equal(storage.value, null);
});

test("生成問題の保存先が使えなくても例外を投げず失敗を返す", () => {
  const level = generatedLevel();
  const original = structuredClone(level);
  const storage = { getItem() { return null; }, setItem() { throw new Error("QuotaExceededError"); } };
  assert.equal(saveGeneratedLevel(storage, level), false);
  assert.deepEqual(level, original);
  assert.equal(saveGeneratedLevel(null, level), false);
});

test("座標配列の順序によらず正しい配置を受け入れ元データを変えない", () => {
  const level = generatedLevel();
  level.cats.reverse();
  const original = structuredClone(level);
  assert.equal(isValidGeneratedLevel(level), true);
  assert.deepEqual(level, original);
});

test("配列順を変えた隣接するネコの配置を拒否する", () => {
  const level = {
    id: "stage-011", name: "不正な問題", size: 5, difficulty: "normal",
    regions: Array.from({ length: 5 }, (_, row) => Array(5).fill(row)),
    cats: [[0, 0], [2, 2], [4, 4], [1, 1], [3, 3]]
  };
  assert.equal(isValidGeneratedLevel(level), false);
});

for (const coordinate of [null, 0, {}, "01", [], [0], [0, 1, 2], [0, 99]]) {
  test("不正な座標形式を例外なしで拒否する: " + JSON.stringify(coordinate), () => {
    const level = generatedLevel();
    level.cats[0] = coordinate;
    assert.equal(isValidGeneratedLevel(level), false);
    assert.equal(saveGeneratedLevel(createStorage(), level), false);
  });
}

test("壊れた座標を含む1問だけを除外し正常なキャッシュを保持する", () => {
  const storage = createStorage();
  const valid = generatedLevel();
  const invalid = generatedLevel("stage-012");
  invalid.cats[0] = null;
  storage.value = JSON.stringify({ generatorVersion: 1, levels: [invalid, valid] });
  assert.deepEqual(loadGeneratedLevels(storage), [valid]);
});
