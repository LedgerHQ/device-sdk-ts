import {
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import type { GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";

import { ApplicationChecker } from "./ApplicationChecker";

describe("ApplicationChecker", () => {
  function createAppConfig(version: string): GetConfigCommandResponse {
    return {
      blindSigningEnabled: false,
      web3ChecksEnabled: false,
      web3ChecksOptIn: false,
      version,
    };
  }

  it("should pass the check for exclusive version", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.13.0-rc" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.13.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .withMinVersionExclusive("1.12.0")
      .check();
    // THEN
    expect(result).toStrictEqual(true);
  });

  it("should reject the check for exclusive version", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.12.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .withMinVersionExclusive("1.12.0")
      .check();
    // THEN
    expect(result).toStrictEqual(false);
  });

  it("should pass the check for inclusive version", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.12.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.10.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .withMinVersionInclusive("1.12.0")
      .check();
    // THEN
    expect(result).toStrictEqual(true);
  });

  it("should reject the check for inclusive version", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.11.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .withMinVersionInclusive("1.12.0")
      .check();
    // THEN
    expect(result).toStrictEqual(false);
  });

  it("should pass the check for excluded device", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.11.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    // THEN
    expect(result).toStrictEqual(true);
  });

  it("should reject the check for excluded device", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.11.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .excludeDeviceModel(DeviceModelId.FLEX)
      .check();
    // THEN
    expect(result).toStrictEqual(false);
  });

  it("should pass the check for chained condition", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.11.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.11.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .withMinVersionInclusive("1.11.0")
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    // THEN
    expect(result).toStrictEqual(true);
  });

  it("should reject the check for chained condition", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.10.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.10.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .withMinVersionInclusive("1.11.0")
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    // THEN
    expect(result).toStrictEqual(false);
  });

  it("should pass the check in plugins", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "1inch", version: "1.11.0-rc" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.13.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .withMinVersionExclusive("1.12.0")
      .check();
    // THEN
    expect(result).toStrictEqual(true);
  });

  it("should reject the check in unknexpected state", () => {
    // GIVEN
    const state = {
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Bitcoin", version: "1.13.0-rc" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.13.0");
    // WHEN
    const result = new ApplicationChecker(state, config)
      .withMinVersionExclusive("1.12.0")
      .check();
    // THEN
    expect(result).toStrictEqual(false);
  });
});
