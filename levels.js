"use strict";

const MEOWDOKU_LEVELS = [
  {
    id: "stage-001",
    size: 5,
    difficulty: "normal",
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
    id: "stage-002",
    size: 5,
    difficulty: "normal",
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
    id: "stage-003",
    size: 5,
    difficulty: "normal",
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
  },
  {
    id: "stage-004",
    size: 5,
    difficulty: "normal",
    name: "レベル 4",
    regions: [
      [1, 1, 4, 3, 3],
      [1, 1, 4, 3, 3],
      [1, 1, 4, 3, 3],
      [1, 4, 4, 4, 0],
      [2, 2, 2, 2, 0]
    ],
    cats: [
      [0, 3],
      [1, 0],
      [2, 2],
      [3, 4],
      [4, 1]
    ]
  },
  {
    id: "stage-005",
    size: 5,
    difficulty: "normal",
    name: "レベル 5",
    regions: [
      [0, 0, 0, 4, 4],
      [0, 3, 3, 4, 4],
      [1, 3, 4, 4, 4],
      [1, 1, 2, 4, 4],
      [1, 1, 2, 2, 2]
    ],
    cats: [
      [0, 0],
      [1, 2],
      [2, 4],
      [3, 1],
      [4, 3]
    ]
  },
  {
    id: "stage-006",
    size: 5,
    difficulty: "normal",
    name: "レベル 6",
    regions: [
      [3, 3, 1, 1, 1],
      [3, 3, 1, 1, 1],
      [3, 3, 3, 0, 1],
      [2, 3, 4, 0, 0],
      [2, 4, 4, 4, 4]
    ],
    cats: [
      [0, 4],
      [1, 1],
      [2, 3],
      [3, 0],
      [4, 2]
    ]
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = MEOWDOKU_LEVELS;
} else {
  globalThis.MEOWDOKU_LEVELS = MEOWDOKU_LEVELS;
}
