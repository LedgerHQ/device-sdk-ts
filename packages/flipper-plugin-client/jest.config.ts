/* eslint no-restricted-syntax: 0 */
import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "@ledgerhq/jest-config-dsdk",
  testPathIgnorePatterns: ["<rootDir>/lib/esm", "<rootDir>/lib/cjs"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.stub.ts",
    "!src/index.ts",
    "!src/api/index.ts",
  ],
};

export default config;
