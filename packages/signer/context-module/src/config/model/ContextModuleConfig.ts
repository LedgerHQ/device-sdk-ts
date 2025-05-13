import { type ContextLoader } from "@/shared/domain/ContextLoader";
import { type TypedDataContextLoader } from "@/typed-data/domain/TypedDataContextLoader";
import { type Web3CheckContextLoader } from "@/web3-check/domain/Web3CheckContextLoader";

export type ContextModuleCalMode = "prod" | "test";
export type ContextModuleCalBranch = "next" | "main" | "demo";

export type ContextModuleCalConfig = {
  url: string;
  mode: ContextModuleCalMode;
  branch: ContextModuleCalBranch;
};

export type ContextModuleWeb3ChecksConfig = {
  url: string;
};

export type ContextModuleConfig = {
  cal: ContextModuleCalConfig;
  web3checks: ContextModuleWeb3ChecksConfig;
  defaultLoaders: boolean;
  customLoaders: ContextLoader[];
  customTypedDataLoader?: TypedDataContextLoader;
  customWeb3CheckLoader?: Web3CheckContextLoader;
  originToken?: string;
};
