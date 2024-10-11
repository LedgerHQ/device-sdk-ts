export type ContextModuleCalMode = "prod" | "test";
export type ContextModuleCalBranch = "next" | "main" | "demo";

export type ContextModuleCalConfig = {
  url: string;
  mode: ContextModuleCalMode;
  branch: ContextModuleCalBranch;
};

export type ContextModuleConfig = {
  cal: ContextModuleCalConfig;
};
