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

  function makeAppConfig(version: string): AppConfig {
    return { version, blindSigningEnabled: false };
  }

  function makeReadyState(
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

  it("should be incompatible when device session is not ready", () => {
    const state = {
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    expect(resolver.resolve(state, makeAppConfig("1.4.0"))).toStrictEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });

  it("should be incompatible when no app is open", () => {
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: undefined,
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    } as unknown as DeviceSessionState;
    expect(resolver.resolve(state, makeAppConfig("1.4.0"))).toStrictEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });

  it("should be incompatible when a different app is open", () => {
    const state = makeReadyState("Bitcoin", "2.1.0");
    expect(resolver.resolve(state, makeAppConfig("1.4.0"))).toStrictEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });

  it("should be compatible and use the version from appConfig when Solana is open", () => {
    // appConfig.version comes from GetAppConfiguration executed live on the device,
    // so it is the authoritative version source even for direct Solana signing.
    const state = makeReadyState("Solana", "1.4.0");
    expect(resolver.resolve(state, makeAppConfig("1.4.0"))).toStrictEqual({
      isCompatible: true,
      version: "1.4.0",
    });
  });

  it("should be compatible and use Solana version from appConfig when Exchange is orchestrating", () => {
    // During a swap, Exchange opens the Solana app on-device without going through
    // OpenAppDeviceAction, so deviceState.currentApp stays as "Exchange".
    // GetAppConfiguration is proxied by Exchange to Solana, so appConfig.version
    // reflects the actual Solana version, not the Exchange app version.
    const state = makeReadyState("Exchange", "4.4.2");
    const solanaAppConfig = makeAppConfig("1.9.5");
    expect(resolver.resolve(state, solanaAppConfig)).toStrictEqual({
      isCompatible: true,
      version: "1.9.5",
    });
  });
});
