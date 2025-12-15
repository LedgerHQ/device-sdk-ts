import {
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import {
  ApplicationChecker,
  ApplicationCheckerSupportedAppNames,
} from "./ApplicationChecker";
import {
  type ApplicationResolver,
  type ResolvedApp,
} from "./ApplicationResolver";

describe("ApplicationChecker", () => {
  function createReadyState(modelId: DeviceModelId = DeviceModelId.FLEX) {
    return {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.0.0" },
      deviceModelId: modelId,
      isSecureConnectionAllowed: false,
    };
  }

  function createMockResolver(resolved: ResolvedApp): ApplicationResolver {
    return {
      resolve: () => resolved,
    };
  }

  const appConfig = { version: "1.0.0" };
  const expectedApp = ApplicationCheckerSupportedAppNames.Ethereum;

  it("should pass check when resolved as compatible", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.12.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    ).check();
    expect(result).toStrictEqual(true);
  });

  it("should reject check when resolved as incompatible", () => {
    const resolver = createMockResolver({
      isCompatible: false,
      version: "0.0.1",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    ).check();
    expect(result).toStrictEqual(false);
  });

  it("should pass with min version inclusive when version matches", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.12.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    )
      .withMinVersionInclusive("1.12.0")
      .check();
    expect(result).toStrictEqual(true);
  });

  it("should reject with min version inclusive when version is too low", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.11.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    )
      .withMinVersionInclusive("1.12.0")
      .check();
    expect(result).toStrictEqual(false);
  });

  it("should pass with min version exclusive when version is greater", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.13.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    )
      .withMinVersionExclusive("1.12.0")
      .check();
    expect(result).toStrictEqual(true);
  });

  it("should reject with min version exclusive when version is equal", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.12.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    )
      .withMinVersionExclusive("1.12.0")
      .check();
    expect(result).toStrictEqual(false);
  });

  it("should pass when device model is not excluded", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.12.0",
    });
    const result = new ApplicationChecker(
      createReadyState(DeviceModelId.FLEX),
      appConfig,
      expectedApp,
      resolver,
    )
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    expect(result).toStrictEqual(true);
  });

  it("should reject when device model is excluded", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.12.0",
    });
    const result = new ApplicationChecker(
      createReadyState(DeviceModelId.FLEX),
      appConfig,
      expectedApp,
      resolver,
    )
      .excludeDeviceModel(DeviceModelId.FLEX)
      .check();
    expect(result).toStrictEqual(false);
  });

  it("should pass with chained conditions when all are met", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.12.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    )
      .withMinVersionInclusive("1.11.0")
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    expect(result).toStrictEqual(true);
  });

  it("should reject with chained conditions when one fails", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.10.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    )
      .withMinVersionInclusive("1.11.0")
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    expect(result).toStrictEqual(false);
  });

  it("should not override incompatible resolution even if constraints pass", () => {
    const resolver = createMockResolver({
      isCompatible: false,
      version: "1.15.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      expectedApp,
      resolver,
    )
      .withMinVersionInclusive("1.12.0")
      .check();
    expect(result).toStrictEqual(false);
  });
});
