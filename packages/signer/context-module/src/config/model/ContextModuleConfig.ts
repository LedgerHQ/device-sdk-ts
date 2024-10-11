export type ContextModuleCalConfig = {
  url: string;
  mode: "prod" | "test";
  branch: "next" | "main" | "demo";
};

export type ContextModuleConfig = {
  cal: ContextModuleCalConfig;
};
