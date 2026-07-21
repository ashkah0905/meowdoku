"use strict";

const MEOWDOKU_PROGRESSION = (() => {
  const GENERATOR_VERSION = 1;
  const CYCLE = [
    { difficulty: "normal", minScore: 40, maxScore: 46 },
    { difficulty: "normal", minScore: 43, maxScore: 49 },
    { difficulty: "normal", minScore: 46, maxScore: 52 },
    { difficulty: "normal", minScore: 49, maxScore: 55 },
    { difficulty: "hard", minScore: 58, maxScore: 66 },
    { difficulty: "normal", minScore: 42, maxScore: 48 },
    { difficulty: "normal", minScore: 46, maxScore: 52 },
    { difficulty: "normal", minScore: 50, maxScore: 56 },
    { difficulty: "normal", minScore: 54, maxScore: 60 },
    { difficulty: "super-hard", minScore: 65, maxScore: 75 }
  ];

  function getBoardSize(levelNumber) {
    if (levelNumber <= 30) {
      return 6;
    }
    if (levelNumber <= 50) {
      return 7;
    }
    return 8;
  }

  function getGenerationOptions(levelNumber) {
    const profile = CYCLE[(levelNumber - 1) % CYCLE.length];
    const size = getBoardSize(levelNumber);
    const sizeScoreOffset = (size - 6) * 2;
    return {
      id: `stage-${String(levelNumber).padStart(3, "0")}`,
      name: `レベル ${levelNumber}`,
      size,
      difficulty: profile.difficulty,
      seed: `meowdoku-v${GENERATOR_VERSION}:${levelNumber}`,
      minScore: profile.minScore + sizeScoreOffset,
      maxScore: profile.maxScore + sizeScoreOffset,
      maxAttempts: 10000
    };
  }

  return { GENERATOR_VERSION, CYCLE, getBoardSize, getGenerationOptions };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_PROGRESSION;
} else {
  globalThis.MEOWDOKU_PROGRESSION = MEOWDOKU_PROGRESSION;
}
