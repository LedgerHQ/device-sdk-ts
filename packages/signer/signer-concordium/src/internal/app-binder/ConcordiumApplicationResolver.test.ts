import {
  type AppConfig,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import {
  CONCORDIUM_APP_VERSION_FLOOR,
  ConcordiumApplicationResolver,
} from "./ConcordiumApplicationResolver";

describe("ConcordiumApplicationResolver", () => {
  const resolver = new ConcordiumApplicationResolver();

  function createAppConfig(version: string): AppConfig {
    return { version };
  }

  function createReadyState(appName: string, appVersion: string) {
    return {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: appName, version: appVersion },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
  }

  function createConnectedState() {
    return {
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Concordium", version: "5.5.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
  }

  it("should resolve as incompatible with floor version when device is Connected", () => {
    const state = createConnectedState();
    const config = createAppConfig("5.5.0");
    const result = resolver.resolve(state, config);

    expect(result).toStrictEqual({
      isCompatible: false,
      version: CONCORDIUM_APP_VERSION_FLOOR,
    });
  });

  it("should resolve as compatible with currentApp.version when app is Concordium", () => {
    const state = createReadyState("Concordium", "5.5.0");
    const config = createAppConfig("1.0.0");
    const result = resolver.resolve(state, config);

    expect(result).toStrictEqual({
      isCompatible: true,
      version: "5.5.0",
    });
  });

  it("should use currentApp.version, not appConfig.version", () => {
    const state = createReadyState("Concordium", "5.4.1");
    const config = createAppConfig("9.9.9");
    const result = resolver.resolve(state, config);

    expect(result).toStrictEqual({
      isCompatible: true,
      version: "5.4.1",
    });
  });

  it("should resolve as incompatible when app name does not match", () => {
    const state = createReadyState("Ethereum", "1.0.0");
    const config = createAppConfig("1.0.0");
    const result = resolver.resolve(state, config);

    expect(result).toStrictEqual({
      isCompatible: false,
      version: CONCORDIUM_APP_VERSION_FLOOR,
    });
  });

  it("should resolve as incompatible when app name is empty", () => {
    const state = createReadyState("", "1.0.0");
    const config = createAppConfig("1.0.0");
    const result = resolver.resolve(state, config);

    expect(result).toStrictEqual({
      isCompatible: false,
      version: CONCORDIUM_APP_VERSION_FLOOR,
    });
  });
});
