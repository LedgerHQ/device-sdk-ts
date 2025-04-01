export type Id = number;

export enum AppTypeDto {
  currency = "currency",
  plugin = "plugin",
  tool = "tool",
  swap = "swap",
}

export type DeviceVersionDto = {
  id: Id | null;
  name: string;
  display_name: string | null;
  target_id: string | null;
  description: string | null;
  device: Id;
  providers: Id[];
  mcu_versions: Id[];
  se_firmware_final_versions: Id[];
  osu_versions: Id[];
  application_versions: Id[];
  date_creation: string | null;
  date_last_modified: string | null;
};

export type ApplicationDto = {
  versionId: Id;
  versionName: string;
  versionDisplayName: string | null;
  version: string;
  currencyId: string | null;
  description: string | null;
  applicationType: AppTypeDto | null;
  dateModified: string;
  icon: string | null;
  authorName: string | null;
  supportURL: string | null;
  contactURL: string | null;
  sourceURL: string | null;
  compatibleWallets: string | null;
  hash: string | null;
  perso: string | null;
  firmware: string | null;
  firmwareKey: string | null;
  delete: string | null;
  deleteKey: string | null;
  bytes: number | null;
  warning: string | null;
  isDevTools: boolean;
  category: number | null;
  parent: number | null;
  parentName: string | null;
};

export type FirmwareOsuVersionDto = {
  id: Id;
  name: string;
  description: string | null;
  display_name: string | null;
  notes: string | null;
  perso: string | null;
  firmware: string | null;
  firmware_key: string | null;
  hash: string | null;
  next_se_firmware_final_version: Id | null;
  previous_se_firmware_final_versions: Id[];
  date_creation: string;
  date_last_modified: string;
  device_versions: Id[];
  providers: Id[];
  minimum_live_common_version: string | null;
};

export type FirmwareFinalVersionDto = {
  id: Id;
  name: string;
  version: string;
  se_firmware: Id | null;
  description: string | null;
  display_name: string | null;
  notes: string | null;
  perso: string | null;
  firmware: string | null;
  firmware_key: string | null;
  hash: string | null;
  distribution_ratio: number | null;
  exclude_by_default: boolean;
  osu_versions: FirmwareOsuVersionDto[];
  date_creation: string;
  date_last_modified: string;
  device_versions: Id[];
  mcu_versions: Id[];
  application_versions: Id[];
  providers: Id[];
  bytes: number | null;
};

export type LatestFirmwareOsuVersionResponseDto = {
  result: string;
  se_firmware_osu_version: FirmwareOsuVersionDto | null;
};

export type McuVersionDto = {
  id: Id;
  mcu: Id;
  name: string;
  description: string | null;
  providers: Id[];
  device_versions: Id[];
  from_bootloader_version: string;
  from_bootloader_version_id: Id | null;
  se_firmware_final_versions: Id[];
  date_creation: string;
  date_last_modified: string;
};

export type LanguagePackageVersionDto = {
  language: string;
  languagePackageVersionId: Id;
  version: string;
  language_package_id: Id;
  apdu_install_url: string;
  apdu_uninstall_url: string;
  device_versions: Id[];
  se_firmware_final_versions: Id[];
  bytes: number;
  date_creation: string;
  date_last_modified: string;
};
