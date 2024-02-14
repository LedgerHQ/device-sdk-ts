/* eslint no-restricted-syntax: 0 */
import type { JestConfigWithTsJest } from "@ledgerhq/jest-config-dsdk";

const config: JestConfigWithTsJest = {
  preset: "@ledgerhq/jest-config-dsdk",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/lib/"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.stub.ts",
    "!src/index.ts",
    "!src/api/index.ts",
  ],
  moduleNameMapper: {
    "^@internal/(.*)$": "<rootDir>/src/internal/$1",
    "^@root/(.*)$": "<rootDir>/$1",
  },
};

export default config;
