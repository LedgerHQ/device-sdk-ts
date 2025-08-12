import {
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it } from "vitest";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";

import { ApplicationChecker } from "./ApplicationChecker";

function createAppConfig(version: string): AppConfiguration {
  return {
    version,
    blindSigningEnabled: false,
    pubKeyDisplayMode: PublicKeyDisplayMode.SHORT,
  };
}

describe("ApplicationChecker (Solana)", () => {
  it("should pass check when on Solana app and in valid state", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.4.0");

    // when
    const result = new ApplicationChecker(state, config).check();

    // then
    expect(result).toBe(true);
  });

  it("should reject if session state is Connected", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.4.0");

    // when
    const result = new ApplicationChecker(state, config).check();

    // then
    expect(result).toBe(false);
  });

  it("should reject if not Solana app", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Ethereum", version: "1.0.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.0.0");
    // when
    const result = new ApplicationChecker(state, config).check();

    // then
    expect(result).toBe(false);
  });

  it("should pass with min version inclusive", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.4.0");

    // when
    const result = new ApplicationChecker(state, config)
      .withMinVersionInclusive("1.3.0")
      .check();

    // then
    expect(result).toBe(true);
  });

  it("should reject with min version inclusive if version too low", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.3.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.3.0");

    // when
    const result = new ApplicationChecker(state, config)
      .withMinVersionInclusive("1.4.0")
      .check();

    // then
    expect(result).toBe(false);
  });

  it("should pass with min version exclusive", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.4.0");

    // when
    const result = new ApplicationChecker(state, config)
      .withMinVersionExclusive("1.3.0")
      .check();

    // then
    expect(result).toBe(true);
  });

  it("should reject with min version exclusive if equal", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.4.0");

    // when
    const result = new ApplicationChecker(state, config)
      .withMinVersionExclusive("1.4.0")
      .check();

    // then
    expect(result).toBe(false);
  });

  it("should reject excluded device model", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.0" },
      deviceModelId: DeviceModelId.NANO_S,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.4.0");

    // when
    const result = new ApplicationChecker(state, config)
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();

    // then
    expect(result).toBe(false);
  });

  it("should allow allowed device model", () => {
    // given
    const state = {
      sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
      deviceStatus: DeviceStatus.CONNECTED,
      installedApps: [],
      currentApp: { name: "Solana", version: "1.4.0" },
      deviceModelId: DeviceModelId.FLEX,
      isSecureConnectionAllowed: false,
    };
    const config = createAppConfig("1.4.0");

    // when
    const result = new ApplicationChecker(state, config)
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();

    // then
    expect(result).toBe(true);
  });
});
