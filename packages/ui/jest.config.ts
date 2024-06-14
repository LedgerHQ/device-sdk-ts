/* eslint no-restricted-syntax: 0 */
import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "@ledgerhq/jest-config-dsdk",
};

export default config;
