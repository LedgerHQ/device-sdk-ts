import type { JestConfigWithTsJest } from "@ledgerhq/jest-config-dsdk";

const config: JestConfigWithTsJest = {
  preset: "@ledgerhq/jest-config-dsdk",
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/lib/"],
  collectCoverageFrom: [
    // TODO: remove internal when the rest of the files are setup
    "src/internal/**/*.ts",
    "!src/**/*.stub.ts",
  ],
  moduleNameMapper: {
    "^@internal/(.*)$": "<rootDir>/src/internal/$1",
    "^@root/(.*)$": "<rootDir>/$1",
  },
};

export default config;
