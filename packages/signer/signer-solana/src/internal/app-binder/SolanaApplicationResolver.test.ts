import {
  type AppConfig,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { SolanaApplicationResolver } from "./SolanaApplicationResolver";

describe("SolanaApplicationResolver", () => {
  const resolver = new SolanaApplicationResolver();

  function createAppConfig(version: string): AppConfig {
    return {
      version,
      blindSigningEnabled: false,
    };
  }

  function createReadyState(
    appName: string,
    appVersion: string,
    modelId: DeviceModelId = DeviceModelId.FLEX,
  ) {
    return {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: appName, version: appVersion },
      deviceModelId: modelId,
      isSecureConnectionAllowed: false,
    };
  }

  function createConnectedState() {
    return {
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.0.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
  }

  it("should resolve as incompatible when device is Connected", () => {
    const state = createConnectedState();
    const config = createAppConfig("1.0.0");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });

  it("should resolve as compatible with currentApp.version when app is Solana", () => {
    const state = createReadyState("Solana", "1.4.0");
    const config = createAppConfig("1.0.0");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: true,
      version: "1.4.0",
    });
  });

  it("should resolve as incompatible when app is not Solana", () => {
    const state = createReadyState("Ethereum", "1.0.0");
    const config = createAppConfig("1.0.0");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });
});
