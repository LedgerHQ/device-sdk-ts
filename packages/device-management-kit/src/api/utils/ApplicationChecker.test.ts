import { DeviceModelId } from "@api/device/DeviceModel";
import { DeviceStatus } from "@api/device/DeviceStatus";
import { DeviceSessionStateType } from "@api/device-session/DeviceSessionState";

import { ApplicationChecker } from "./ApplicationChecker";
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
      currentApp: { name: "TestApp", version: "1.0.0" },
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

  it("should pass check when resolved as compatible", () => {
    const resolver = createMockResolver({
      isCompatible: true,
      version: "1.12.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
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
      resolver,
    )
      .withMinVersionInclusive("1.11.0")
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    expect(result).toStrictEqual(false);
  });

  describe("withMinVersionInclusiveAcceptingPrerelease", () => {
    it("should accept a release candidate of the minimum", () => {
      const resolver = createMockResolver({
        isCompatible: true,
        version: "1.23.0-rc2",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("1.23.0")
        .check();
      expect(result).toStrictEqual(true);
    });

    it("should accept a dev build of the minimum", () => {
      const resolver = createMockResolver({
        isCompatible: true,
        version: "1.23.0-dev",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("1.23.0")
        .check();
      expect(result).toStrictEqual(true);
    });

    it("should accept a plain version equal to the minimum", () => {
      const resolver = createMockResolver({
        isCompatible: true,
        version: "1.23.0",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("1.23.0")
        .check();
      expect(result).toStrictEqual(true);
    });

    it("should accept a plain version above the minimum", () => {
      const resolver = createMockResolver({
        isCompatible: true,
        version: "1.24.0",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("1.23.0")
        .check();
      expect(result).toStrictEqual(true);
    });

    it("should reject a plain version below the minimum", () => {
      const resolver = createMockResolver({
        isCompatible: true,
        version: "1.22.9",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("1.23.0")
        .check();
      expect(result).toStrictEqual(false);
    });

    it("should reject a prerelease whose release core is below the minimum", () => {
      const resolver = createMockResolver({
        isCompatible: true,
        version: "1.22.9-rc5",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("1.23.0")
        .check();
      expect(result).toStrictEqual(false);
    });

    it("should reject a version that cannot be parsed", () => {
      const resolver = createMockResolver({
        isCompatible: true,
        version: "not-a-version",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("1.23.0")
        .check();
      expect(result).toStrictEqual(false);
    });

    it("should reject a minimum that cannot be parsed", () => {
      const resolver = createMockResolver({
        isCompatible: true,
        version: "1.23.0",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("not-a-version")
        .check();
      expect(result).toStrictEqual(false);
    });

    it("should not override incompatible resolution", () => {
      const resolver = createMockResolver({
        isCompatible: false,
        version: "1.23.0-rc2",
      });
      const result = new ApplicationChecker(
        createReadyState(),
        appConfig,
        resolver,
      )
        .withMinVersionInclusiveAcceptingPrerelease("1.23.0")
        .check();
      expect(result).toStrictEqual(false);
    });
  });

  it("should not override incompatible resolution even if constraints pass", () => {
    const resolver = createMockResolver({
      isCompatible: false,
      version: "1.15.0",
    });
    const result = new ApplicationChecker(
      createReadyState(),
      appConfig,
      resolver,
    )
      .withMinVersionInclusive("1.12.0")
      .check();
    expect(result).toStrictEqual(false);
  });
});
