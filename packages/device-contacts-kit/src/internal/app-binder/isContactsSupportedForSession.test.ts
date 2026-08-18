import {
  type AppConfig,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import {
  ETHEREUM_APP_NAME,
  resolveContactsVersionRequirements,
} from "@api/model/ContactsVersionRequirements";

import { isContactsSupportedForSession } from "./isContactsSupportedForSession";

const flexSupport = (() => {
  const requirement = resolveContactsVersionRequirements(DeviceModelId.FLEX);
  if (!requirement.supported) throw new Error("Flex must be supported");
  return requirement;
})();

const MIN_OS_VERSION = flexSupport.minOsVersion;
const MIN_APP_VERSION = (() => {
  const version = flexSupport.minAppVersion[ETHEREUM_APP_NAME];
  if (version === undefined) throw new Error("Ethereum min version required");
  return version;
})();
const BELOW_ANY_VERSION = "0.0.1";

type ReadyStateOptions = {
  appName?: string;
  osVersion?: string;
  modelId?: DeviceModelId;
};

function createReadyState({
  appName = ETHEREUM_APP_NAME,
  osVersion = MIN_OS_VERSION,
  modelId = DeviceModelId.FLEX,
}: ReadyStateOptions = {}) {
  return {
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name: appName, version: "0.0.0" },
    deviceModelId: modelId,
    firmwareVersion: { mcu: "1.0.0", bootloader: "1.0.0", os: osVersion },
    isSecureConnectionAllowed: false,
  };
}

function createInternalApi(deviceState: object): InternalApi {
  return {
    getDeviceSessionState: () => deviceState,
  } as unknown as InternalApi;
}

function appConfig(version: string): AppConfig {
  return { version };
}

describe("isContactsSupportedForSession", () => {
  it("returns true when model, app version and OS version all meet the minimums", () => {
    const api = createInternalApi(createReadyState());
    expect(isContactsSupportedForSession(api, appConfig(MIN_APP_VERSION))).toBe(
      true,
    );
  });

  it("returns false on an unsupported device model", () => {
    const api = createInternalApi(
      createReadyState({ modelId: DeviceModelId.NANO_X }),
    );
    expect(isContactsSupportedForSession(api, appConfig(MIN_APP_VERSION))).toBe(
      false,
    );
  });

  // App-version requirement.
  it("returns false when the app version is below the minimum", () => {
    const api = createInternalApi(createReadyState());
    expect(
      isContactsSupportedForSession(api, appConfig(BELOW_ANY_VERSION)),
    ).toBe(false);
  });

  it("returns false when the running app is unknown to Contacts", () => {
    const api = createInternalApi(createReadyState({ appName: "Bitcoin" }));
    expect(isContactsSupportedForSession(api, appConfig(MIN_APP_VERSION))).toBe(
      false,
    );
  });

  // OS-version requirement.
  it("returns false when the OS version is below the minimum", () => {
    const api = createInternalApi(
      createReadyState({ osVersion: BELOW_ANY_VERSION }),
    );
    expect(isContactsSupportedForSession(api, appConfig(MIN_APP_VERSION))).toBe(
      false,
    );
  });

  it("returns false when the device session has no running app", () => {
    const api = createInternalApi({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      deviceModelId: DeviceModelId.FLEX,
    });
    expect(isContactsSupportedForSession(api, appConfig(MIN_APP_VERSION))).toBe(
      false,
    );
  });
});
