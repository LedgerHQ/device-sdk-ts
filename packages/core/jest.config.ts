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
};

export default config;
