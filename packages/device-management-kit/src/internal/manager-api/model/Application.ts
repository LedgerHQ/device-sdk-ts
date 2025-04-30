export enum AppType {
  currency = "currency",
  plugin = "plugin",
  tool = "tool",
  swap = "swap",
}

export type Application = {
  versionId: number;
  versionName: string;
  versionDisplayName: string | null;
  version: string;
  currencyId: string | null;
  description: string | null;
  applicationType: AppType | null;
  dateModified: string;
  icon: string | null;
  authorName: string | null;
  supportURL: string | null;
  contactURL: string | null;
  sourceURL: string | null;
  compatibleWallets: string | null;
  hash: string;
  perso: string;
  firmware: string;
  firmwareKey: string;
  delete: string;
  deleteKey: string;
  bytes: number | null;
  warning: string | null;
  isDevTools: boolean;
  category: number | null;
  parent: number | null;
  parentName: string | null;
};
