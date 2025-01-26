import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";

export class DefaultSecureChannelDataSource implements SecureChannelDataSource {
  genuineCheck = jest.fn();
  listInstalledApps = jest.fn();
  updateMcu = jest.fn();
  updateFirmware = jest.fn();
  installApp = jest.fn();
  uninstallApp = jest.fn();
}
