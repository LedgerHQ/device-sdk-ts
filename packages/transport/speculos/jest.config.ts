/* eslint no-restricted-syntax: 0 */
import { type JestConfigWithTsJest, pathsToModuleNameMapper } from "ts-jest";

import { compilerOptions } from "./tsconfig.json";

const paths = pathsToModuleNameMapper(compilerOptions.paths, {
  prefix: "<rootDir>/",
});

const config: JestConfigWithTsJest = {
  preset: "@ledgerhq/jest-config-dsdk",
  // setupFiles: ["<rootDir>/jest.setup.ts"],
  testPathIgnorePatterns: ["<rootDir>/lib/esm/", "<rootDir>/lib/cjs/"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.stub.ts",
    "!src/index.ts",
    "!src/api/index.ts",
  ],
  moduleNameMapper: {
    ...paths,
  },
};

export default config;
