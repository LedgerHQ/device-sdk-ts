import {
  type AppConfig,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { EthereumApplicationResolver } from "./EthereumApplicationResolver";

describe("EthereumApplicationResolver", () => {
  const resolver = new EthereumApplicationResolver();

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
      currentApp: { name: "Ethereum", version: "1.0.0" },
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

  it("should resolve as compatible with currentApp.version when app is Ethereum", () => {
    const state = createReadyState("Ethereum", "1.13.0-rc");
    const config = createAppConfig("1.10.0");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: true,
      version: "1.13.0-rc",
    });
  });

  it("should resolve as compatible with appConfig.version for plugin apps", () => {
    const state = createReadyState("1inch", "1.11.0-rc");
    const config = createAppConfig("1.13.0");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: true,
      version: "1.13.0",
    });
  });

  it("should resolve as incompatible when app is Exchange", () => {
    const state = createReadyState("Exchange", "1.13.0-rc");
    const config = createAppConfig("1.13.0");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });
});
