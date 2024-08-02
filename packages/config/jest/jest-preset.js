/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/js-with-ts",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
};

module.exports = config;
