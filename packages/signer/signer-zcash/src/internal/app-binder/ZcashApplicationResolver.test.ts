import {
  type AppConfig,
  ApplicationChecker,
  DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
  DeviceStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import {
  appVersionWithoutV6Support,
  MIN_APP_VERSION_FOR_V6_TRANSACTIONS,
  ZcashApplicationResolver,
} from "./ZcashApplicationResolver";

const NO_APP_CONFIG: AppConfig = { version: "" };

const readyState = (appName: string, appVersion: string): DeviceSessionState =>
  ({
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name: appName, version: appVersion },
    deviceModelId: DeviceModelId.FLEX,
    isSecureConnectionAllowed: false,
  }) as DeviceSessionState;

const connectedState = (): DeviceSessionState =>
  ({
    sessionStateType: DeviceSessionStateType.Connected,
    deviceStatus: DeviceStatus.CONNECTED,
    deviceModelId: DeviceModelId.FLEX,
  }) as DeviceSessionState;

const apiWithState = (deviceState: DeviceSessionState): InternalApi =>
  ({
    getDeviceSessionState: () => deviceState,
  }) as unknown as InternalApi;

const apiWithAppVersion = (appVersion: string): InternalApi =>
  apiWithState(readyState("Zcash", appVersion));

describe("ZcashApplicationResolver", () => {
  const resolver = new ZcashApplicationResolver();

  it("resolves the version the session state reports for the Zcash app", () => {
    expect(
      resolver.resolve(readyState("Zcash", "3.0.2"), NO_APP_CONFIG),
    ).toEqual({ isCompatible: true, version: "3.0.2" });
  });

  it("resolves as incompatible when another app is open", () => {
    expect(
      resolver.resolve(readyState("Bitcoin", "2.4.0"), NO_APP_CONFIG)
        .isCompatible,
    ).toBe(false);
  });

  it("resolves as incompatible when the session carries no app", () => {
    expect(resolver.resolve(connectedState(), NO_APP_CONFIG).isCompatible).toBe(
      false,
    );
  });
});

describe("appVersionWithoutV6Support", () => {
  it("returns the version of an app that predates v6 support", () => {
    // The version app 3.0.2 answered 6a80 with, at the v6 version word.
    expect(appVersionWithoutV6Support(apiWithAppVersion("3.0.2"))).toBe(
      "3.0.2",
    );
  });

  it("returns nothing for the first version supporting v6", () => {
    expect(
      appVersionWithoutV6Support(
        apiWithAppVersion(MIN_APP_VERSION_FOR_V6_TRANSACTIONS),
      ),
    ).toBeUndefined();
  });

  it("returns nothing for a later release on the Ironwood line", () => {
    expect(
      appVersionWithoutV6Support(apiWithAppVersion("3.8.1")),
    ).toBeUndefined();
  });

  it("judges every 3.0.x release as lacking v6 support", () => {
    expect(appVersionWithoutV6Support(apiWithAppVersion("3.0.2"))).toBe(
      "3.0.2",
    );
    expect(appVersionWithoutV6Support(apiWithAppVersion("3.0.3"))).toBe(
      "3.0.3",
    );
    expect(appVersionWithoutV6Support(apiWithAppVersion("3.0.10"))).toBe(
      "3.0.10",
    );
  });

  it("orders versions by number, not as strings", () => {
    // As a string "3.10.0" sorts below the floor.
    expect(
      appVersionWithoutV6Support(apiWithAppVersion("3.10.0")),
    ).toBeUndefined();
    expect(
      appVersionWithoutV6Support(apiWithAppVersion("3.9.0")),
    ).toBeUndefined();
  });

  it("judges no version when the session state reports none", () => {
    expect(
      appVersionWithoutV6Support(apiWithState(connectedState())),
    ).toBeUndefined();
    expect(
      appVersionWithoutV6Support(apiWithState(readyState("Bitcoin", "2.4.0"))),
    ).toBeUndefined();
  });

  it("judges no version it cannot read, such as a development build", () => {
    expect(
      appVersionWithoutV6Support(apiWithAppVersion("ironwood")),
    ).toBeUndefined();
  });
});

describe("version ordering behind the gate", () => {
  const resolver = new ZcashApplicationResolver();

  const clearsFloor = (appVersion: string, floor: string): boolean =>
    new ApplicationChecker(
      readyState("Zcash", appVersion),
      NO_APP_CONFIG,
      resolver,
    )
      .withMinVersionInclusive(floor)
      .check();

  // Compared as strings "3.10.0" sorts below "3.9.0", which would gate an app
  // that does support v6. Only a numeric comparison of each field gets this right.
  it("ranks a two-digit minor above a one-digit minor", () => {
    expect(clearsFloor("3.10.0", "3.9.0")).toBe(true);
    expect(clearsFloor("3.9.0", "3.10.0")).toBe(false);
  });

  it("ranks a two-digit patch above a one-digit patch", () => {
    expect(clearsFloor("3.0.10", "3.0.3")).toBe(true);
    expect(clearsFloor("3.0.3", "3.0.10")).toBe(false);
  });

  it("admits a version equal to the floor", () => {
    expect(
      clearsFloor(
        MIN_APP_VERSION_FOR_V6_TRANSACTIONS,
        MIN_APP_VERSION_FOR_V6_TRANSACTIONS,
      ),
    ).toBe(true);
  });
});
