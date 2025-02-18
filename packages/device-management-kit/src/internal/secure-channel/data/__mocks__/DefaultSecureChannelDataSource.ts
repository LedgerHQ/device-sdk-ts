import { type SecureChannelDataSource } from "@internal/secure-channel/data/SecureChannelDataSource";

export class DefaultSecureChannelDataSource implements SecureChannelDataSource {
  genuineCheck = vi.fn();
  listInstalledApps = vi.fn();
  updateMcu = vi.fn();
  updateFirmware = vi.fn();
  installApp = vi.fn();
  uninstallApp = vi.fn();
}
