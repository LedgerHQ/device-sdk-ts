export type Id = number;

export enum AppTypeDto {
  currency = "currency",
  plugin = "plugin",
  tool = "tool",
  swap = "swap",
}

export type ApplicationDto = {
  versionId: Id;
  versionName: string;
  versionDisplayName: string;
  version: string;
  currencyId: string;
  description: string;
  applicationType: AppTypeDto;
  dateModified: string;
  icon: string;
  authorName: string;
  supportURL: string;
  contactURL: string;
  sourceURL: string;
  compatibleWallets: string;
  hash: string;
  perso: string;
  firmware: string;
  firmwareKey: string;
  delete: string;
  deleteKey: string;
  bytes: number;
  warning: string | null;
  isDevTools: boolean;
  category: number;
  parent: number | null;
  parentName: string | null;
};
