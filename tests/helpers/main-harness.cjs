"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Run the real browser entry point with controllable storage, Worker and timers.
function createApp({ savedState, failWrites = false, workerAvailable = true, denyStorage = false } = {}) {
  const elements = new Map();
  const timers = new Map();
  const values = new Map();
  let timerId = 0;
  const writeCounts = new Map();
  if (savedState) values.set("meowdoku-logic-v1", JSON.stringify(savedState));
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (failWrites) throw new Error("QuotaExceededError");
      writeCounts.set(key, (writeCounts.get(key) ?? 0) + 1);
      values.set(key, value);
    }
  };
  function element() {
    const classes = new Set();
    const listeners = new Map();
    return {
      hidden: false, disabled: false, dataset: {}, children: [], attributes: {},
      style: { setProperty() {} },
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }
      },
      setAttribute(name, value) { this.attributes[name] = value; },
      appendChild(child) { this.children.push(child); },
      contains(child) { return this.children.includes(child); },
      closest(selector) { return selector === ".cell" && this.className?.startsWith("cell ") ? this : null; },
      set innerHTML(value) { this.children = []; },
      focus() { document.activeElement = this; },
      addEventListener(name, listener) { listeners.set(name, listener); },
      dispatch(name, event = {}) { return listeners.get(name)?.(event); },
      querySelector(selector) {
        if (selector === ".cell") return this.children[0] ?? null;
        const index = selector.match(/data-index="(\d+)"/);
        if (index) return this.children.find((child) => child.dataset.index === index[1]);
        return elements.get(selector);
      }
    };
  }
  const document = element();
  document.documentElement = element();
  document.createElement = element;
  document.querySelector = (selector) => elements.get(selector);
  const html = fs.readFileSync(path.join(__dirname, "../../index.html"), "utf8");
  for (const [, id] of html.matchAll(/id="([^"]+)"/g)) elements.set(`#${id}`, element());
  elements.set(".dialog-backdrop", element());
  const worker = element();
  worker.messages = [];
  worker.postMessage = (message) => worker.messages.push(message);
  const context = vm.createContext({
    document, localStorage: storage, navigator: {},
    window: {
      matchMedia() { return { matches: false, addEventListener() {} }; },
      setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
      clearTimeout(id) { timers.delete(id); }
    },
    Worker: function () {
      if (!workerAvailable) throw new Error("Worker unavailable");
      return worker;
    }
  });
  if (denyStorage) {
    Object.defineProperty(context, "localStorage", { get() { throw new Error("SecurityError"); } });
  }
  for (const [, filename] of html.matchAll(/<script src="\.\/([^"?]+)(?:\?[^"]*)?"><\/script>/g)) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../..", filename), "utf8"), context);
  }
  document.dispatch("DOMContentLoaded");
  return {
    context, storage, worker, document,
    writes: (key) => writeCounts.get(key) ?? 0,
    get: (id) => elements.get(`#${id}`),
    run: (code) => vm.runInContext(code, context),
    runTimers(delay) {
      for (const [id, timer] of [...timers]) {
        if (timer.delay === delay) { timers.delete(id); timer.callback(); }
      }
    }
  };
}

module.exports = { createApp };
