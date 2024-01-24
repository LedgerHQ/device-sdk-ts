import type { JestConfigWithTsJest } from "@ledgerhq/jest-config-dsdk";

const config: JestConfigWithTsJest = {
  preset: "@ledgerhq/jest-config-dsdk",
  setupFiles: ["<rootDir>/jest.setup.ts"],
};

export default config;
