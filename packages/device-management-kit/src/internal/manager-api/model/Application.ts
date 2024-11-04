export enum AppType {
  currency = "currency",
  plugin = "plugin",
  tool = "tool",
  swap = "swap",
}

export type Application = {
  versionId: number;
  versionName: string;
  versionDisplayName: string;
  version: string;
  currencyId: string;
  description: string;
  applicationType: AppType;
  dateModified: string;
  icon: string;
  authorName: string;
  supportURL: string;
  contactURL: string;
  sourceURL: string;
  hash: string;
  perso: string;
  parentName: string | null;
  firmware: string;
  firmwareKey: string;
  delete: string;
  deleteKey: string;
  bytes: number;
  warning: string | null;
  isDevTools: boolean;
};
