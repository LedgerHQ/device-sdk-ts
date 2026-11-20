import {
  type AppConfig,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { XrpApplicationResolver } from "./XrpApplicationResolver";

describe("XrpApplicationResolver", () => {
  const resolver = new XrpApplicationResolver();
  const appConfig = { version: "2.9.0" } as AppConfig;

  const readyState = (name: string) => ({
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name, version: "2.9.0" },
    deviceModelId: DeviceModelId.STAX,
    isSecureConnectionAllowed: false,
  });

  it("resolves the XRP app version from its app config", () => {
    expect(resolver.resolve(readyState("XRP"), appConfig)).toEqual({
      isCompatible: true,
      version: "2.9.0",
    });
  });

  it("rejects another running app", () => {
    expect(resolver.resolve(readyState("Ethereum"), appConfig)).toEqual({
      isCompatible: false,
      version: "0.0.1",
    });
  });

  it("rejects the dashboard state", () => {
    expect(
      resolver.resolve(
        {
          ...readyState("XRP"),
          sessionStateType: DeviceSessionStateType.Connected,
        },
        appConfig,
      ),
    ).toEqual({ isCompatible: false, version: "0.0.1" });
  });
});
