import {
  type AppConfig,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { TronApplicationResolver } from "./TronApplicationResolver";

describe("TronApplicationResolver", () => {
  const resolver = new TronApplicationResolver();
  const appConfig = { version: "0.8.0" } as AppConfig;

  const readyState = (name: string, version: string) => ({
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name, version },
    deviceModelId: DeviceModelId.FLEX,
    isSecureConnectionAllowed: false,
  });

  it("resolves the running Tron app version", () => {
    expect(
      resolver.resolve(readyState("Tron", "0.8.0-rc2"), appConfig),
    ).toEqual({
      isCompatible: true,
      version: "0.8.0-rc2",
    });
  });

  it("rejects another running app", () => {
    expect(
      resolver.resolve(readyState("Ethereum", "1.23.0"), appConfig),
    ).toEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });

  it("rejects the dashboard state", () => {
    expect(
      resolver.resolve(
        {
          ...readyState("Tron", "0.8.0"),
          sessionStateType: DeviceSessionStateType.Connected,
        },
        appConfig,
      ),
    ).toEqual({ isCompatible: false, version: "0.0.1" });
  });
});
