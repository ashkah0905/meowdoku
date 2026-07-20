"use strict";

const MEOWDOKU_LEVELS = [
  {
    name: "レベル 1",
    regions: [
      [0, 0, 0, 0, 1],
      [3, 0, 0, 0, 1],
      [3, 2, 2, 2, 2],
      [3, 2, 2, 2, 2],
      [3, 2, 2, 4, 4]
    ],
    cats: [
      [0, 1],
      [1, 4],
      [2, 2],
      [3, 0],
      [4, 3]
    ]
  },
  {
    name: "レベル 2",
    regions: [
      [1, 1, 0, 0, 0],
      [1, 1, 2, 0, 0],
      [1, 1, 2, 2, 2],
      [1, 3, 3, 3, 2],
      [4, 3, 3, 3, 3]
    ],
    cats: [
      [0, 3],
      [1, 1],
      [2, 4],
      [3, 2],
      [4, 0]
    ]
  },
  {
    name: "レベル 3",
    regions: [
      [0, 2, 1, 1, 1],
      [2, 2, 2, 1, 1],
      [2, 2, 2, 1, 3],
      [2, 3, 3, 3, 3],
      [2, 2, 4, 3, 3]
    ],
    cats: [
      [0, 0],
      [1, 3],
      [2, 1],
      [3, 4],
      [4, 2]
    ]
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_LEVELS;
} else {
  globalThis.MEOWDOKU_LEVELS = MEOWDOKU_LEVELS;
}
