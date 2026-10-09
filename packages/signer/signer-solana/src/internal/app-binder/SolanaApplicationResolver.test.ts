import {
  resolveContactsVersionRequirements,
  SOLANA_APP_NAME,
} from "@ledgerhq/device-contacts-kit";
import {
  type AppConfig,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";

import {
  isSolanaSignerFeatureSupported,
  SOLANA_SIGNER_FEATURES,
  SolanaApplicationResolver,
} from "./SolanaApplicationResolver";

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

describe("SolanaApplicationResolver", () => {
  const resolver = new SolanaApplicationResolver();

  it("should resolve as incompatible when device is Connected", () => {
    const state = createConnectedState();
    const config = createAppConfig("1.0.0");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });

  it("should resolve as compatible with appConfig.version when app is Solana", () => {
    const state = createReadyState("Solana", "1.4.0");
    const config = createAppConfig("1.0.0");
    const result = resolver.resolve(state, config);
    expect(result).toStrictEqual({
      isCompatible: true,
      version: "1.0.0",
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

describe("isSolanaSignerFeatureSupported", () => {
  const appConfig: AppConfiguration = {
    blindSigningEnabled: false,
    pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
    version: "99.0.0",
  };
  // getDeviceSessionState is never reached when the feature is force-disabled.
  const mockApi = {} as unknown as InternalApi;

  it("returns false immediately when the feature is in disabledFeatures", () => {
    const result = isSolanaSignerFeatureSupported(
      mockApi,
      "spl",
      appConfig,
      new Set(["spl"]),
    );
    expect(result).toBe(false);
  });
});

describe("contacts feature", () => {
  const appConfig: AppConfiguration = {
    blindSigningEnabled: false,
    pubKeyDisplayMode: PublicKeyDisplayMode.LONG,
    version: "99.0.0",
  };
  const apiWith = (appName: string, modelId: DeviceModelId) =>
    ({
      getDeviceSessionState: () =>
        createReadyState(appName, appConfig.version, modelId),
    }) as unknown as InternalApi;

  it("takes its versions from contacts-kit", () => {
    const flex = resolveContactsVersionRequirements(DeviceModelId.FLEX);
    if (!flex.supported) throw new Error("Flex must support contacts");

    expect(SOLANA_SIGNER_FEATURES.contacts.minVersion).toBe(
      flex.minAppVersion[SOLANA_APP_NAME],
    );
    expect(SOLANA_SIGNER_FEATURES.contacts.excludedModels).toEqual([
      DeviceModelId.NANO_S,
    ]);
  });

  it("is supported by the Solana app on a model with contacts", () => {
    expect(
      isSolanaSignerFeatureSupported(
        apiWith("Solana", DeviceModelId.FLEX),
        "contacts",
        appConfig,
      ),
    ).toBe(true);
  });

  it("is not supported on a model without contacts", () => {
    expect(
      isSolanaSignerFeatureSupported(
        apiWith("Solana", DeviceModelId.NANO_S),
        "contacts",
        appConfig,
      ),
    ).toBe(false);
  });

  it("is not supported while Exchange orchestrates the signature", () => {
    expect(
      isSolanaSignerFeatureSupported(
        apiWith("Exchange", DeviceModelId.FLEX),
        "contacts",
        appConfig,
      ),
    ).toBe(false);
  });
});
