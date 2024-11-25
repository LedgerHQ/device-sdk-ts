import { type ContextLoader } from "@/shared/domain/ContextLoader";
import { type TypedDataContextLoader } from "@/typed-data/domain/TypedDataContextLoader";

export type ContextModuleCalMode = "prod" | "test";
export type ContextModuleCalBranch = "next" | "main" | "demo";

export type ContextModuleCalConfig = {
  url: string;
  mode: ContextModuleCalMode;
  branch: ContextModuleCalBranch;
};

export type ContextModuleConfig = {
  cal: ContextModuleCalConfig;
  defaultLoaders: boolean;
  customLoaders: ContextLoader[];
  customTypedDataLoader?: TypedDataContextLoader;
};
