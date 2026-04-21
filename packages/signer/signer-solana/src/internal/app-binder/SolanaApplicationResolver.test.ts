import {
  type AppConfig,
  DeviceModelId,
  type DeviceSessionState,
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

  it("should resolve as incompatible when currentApp is not set", () => {
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: undefined,
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    } as unknown as DeviceSessionState;
    const config = createAppConfig("1.12.1");
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

  it("should resolve as compatible using appConfig.version when Exchange is the current app", () => {
    const state = createReadyState("Exchange", "4.4.2");
    const config = createAppConfig("1.12.1");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: true,
      version: "1.12.1",
    });
  });

  it("should resolve as incompatible when app is not Solana or Exchange", () => {
    const state = createReadyState("Bitcoin", "2.1.0");
    const config = createAppConfig("1.12.1");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });
});
