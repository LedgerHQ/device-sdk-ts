/* eslint no-restricted-syntax: 0 */
import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "@ledgerhq/jest-config-dsdk",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/lib/esm", "<rootDir>/lib/cjs"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.stub.ts",
    "!src/index.ts",
    "!src/api/index.ts",
  ],
  moduleNameMapper: {
    "^@api/(.*)$": "<rootDir>/src/api/$1",
    "^@internal/(.*)$": "<rootDir>/src/internal/$1",
    "^@root/(.*)$": "<rootDir>/$1",
  },
};

export default config;