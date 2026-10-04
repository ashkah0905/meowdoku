"use strict";

importScripts(
  "./rules.js",
  "./solver.js",
  "./level-analyzer.js",
  "./level-generator.js?v=3",
  "./progression.js?v=3"
);

self.addEventListener("message", (event) => {
  const { requestId, levelNumber } = event.data;
  const options = globalThis.MEOWDOKU_PROGRESSION.getGenerationOptions(levelNumber);
  const result = globalThis.MEOWDOKU_LEVEL_GENERATOR.generateLevel(options);
  self.postMessage({ requestId, levelNumber, level: result?.level ?? null });
});
