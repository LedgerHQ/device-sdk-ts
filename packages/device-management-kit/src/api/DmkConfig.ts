export type DmkConfig = {
  mockUrl: string;
  managerApiUrl: string;
  webSocketUrl: string;
  provider: number;
  /**
   * Initial firmware distribution salt. If the salt is not known when DMK is
   * built, set it later with `DeviceManagementKit.setFirmwareDistributionSalt`.
   */
  firmwareDistributionSalt: string;
};
