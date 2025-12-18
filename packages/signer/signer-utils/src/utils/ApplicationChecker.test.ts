import {
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import {
  type AppConfig,
  ApplicationChecker,
  ApplicationCheckerSupportedAppNames,
} from "./ApplicationChecker";

describe("ApplicationChecker", () => {
  function createAppConfig(version: string): AppConfig {
    return {
      blindSigningEnabled: false,
      web3ChecksEnabled: false,
      web3ChecksOptIn: false,
      version,
    };
  }

  it("should pass the check for exclusive version", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.13.0-rc" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.13.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionExclusive("1.12.0")
      .check();
    // then
    expect(result).toStrictEqual(true);
  });

  it("should reject the check for exchange flows", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Exchange", version: "1.13.0-rc" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.13.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionExclusive("1.12.0")
      .check();
    // then
    expect(result).toStrictEqual(false);
  });

  it("should reject the check for exclusive version", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.12.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionExclusive("1.12.0")
      .check();
    // then
    expect(result).toStrictEqual(false);
  });

  it("should pass the check for inclusive version", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.10.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionInclusive("1.12.0")
      .check();
    // then
    expect(result).toStrictEqual(true);
  });

  it("should reject the check for inclusive version", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.11.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionInclusive("1.12.0")
      .check();
    // then
    expect(result).toStrictEqual(false);
  });

  it("should pass the check for excluded device", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.11.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    // then
    expect(result).toStrictEqual(true);
  });

  it("should reject the check for excluded device", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.11.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .excludeDeviceModel(DeviceModelId.FLEX)
      .check();
    // then
    expect(result).toStrictEqual(false);
  });

  it("should pass the check for chained condition", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.11.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionInclusive("1.11.0")
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    // then
    expect(result).toStrictEqual(true);
  });

  it("should reject the check for chained condition", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.10.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.10.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionInclusive("1.11.0")
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    // then
    expect(result).toStrictEqual(false);
  });

  it("should pass the check in plugins", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "1inch", version: "1.11.0-rc" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.13.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionExclusive("1.12.0")
      .check();
    // then
    expect(result).toStrictEqual(true);
  });

  it("should reject the check in unknexpected state", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Bitcoin", version: "1.13.0-rc" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.13.0");
    // when
    const result = new ApplicationChecker(
      state,
      config,
      ApplicationCheckerSupportedAppNames.Ethereum,
    )
      .withMinVersionExclusive("1.12.0")
      .check();
    // then
    expect(result).toStrictEqual(false);
  });
});
