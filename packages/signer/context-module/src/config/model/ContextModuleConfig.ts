export type ContextModuleCalConfig = {
  url: string;
  mode: "prod" | "test";
};

export type ContextModuleConfig = {
  cal: ContextModuleCalConfig;
};
