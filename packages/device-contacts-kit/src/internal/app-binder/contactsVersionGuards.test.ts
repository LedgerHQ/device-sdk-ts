import {
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import {
  ETHEREUM_APP_NAME,
  resolveContactsVersionRequirements,
} from "@api/model/ContactsVersionRequirements";

import {
  isContactsAppVersionSupportedForSession,
  isContactsOsSupportedForSession,
  type RunningApp,
} from "./contactsVersionGuards";

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
  osVersion?: string;
  modelId?: DeviceModelId;
};

function createReadyState({
  osVersion = MIN_OS_VERSION,
  modelId = DeviceModelId.FLEX,
}: ReadyStateOptions = {}) {
  return {
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceStatus: DeviceStatus.CONNECTED,
    installedApps: [],
    currentApp: { name: ETHEREUM_APP_NAME, version: "0.0.0" },
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

// The running app identity now comes from the caller (a fresh
// WaitForAppAndVersion result), not the device session state.
function runningApp(
  name = ETHEREUM_APP_NAME,
  version = MIN_APP_VERSION,
): RunningApp {
  return { name, version };
}

describe("isContactsAppVersionSupportedForSession", () => {
  it("returns true when the model and app version meet the minimums", () => {
    const api = createInternalApi(createReadyState());
    expect(isContactsAppVersionSupportedForSession(api, runningApp())).toBe(
      true,
    );
  });

  it("returns true regardless of OS version, since app-owned operations are not gated by it", () => {
    const api = createInternalApi(
      createReadyState({ osVersion: BELOW_ANY_VERSION }),
    );
    expect(isContactsAppVersionSupportedForSession(api, runningApp())).toBe(
      true,
    );
  });

  it("returns false on an unsupported device model", () => {
    const api = createInternalApi(
      createReadyState({ modelId: DeviceModelId.NANO_X }),
    );
    expect(isContactsAppVersionSupportedForSession(api, runningApp())).toBe(
      false,
    );
  });

  it("returns false when the app version is below the minimum", () => {
    const api = createInternalApi(createReadyState());
    expect(
      isContactsAppVersionSupportedForSession(
        api,
        runningApp(ETHEREUM_APP_NAME, BELOW_ANY_VERSION),
      ),
    ).toBe(false);
  });

  it("returns false when the running app is unknown to Contacts", () => {
    const api = createInternalApi(createReadyState());
    expect(
      isContactsAppVersionSupportedForSession(api, runningApp("Bitcoin")),
    ).toBe(false);
  });

  it("returns false when the device session has no running app", () => {
    const api = createInternalApi({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      deviceModelId: DeviceModelId.FLEX,
    });
    expect(isContactsAppVersionSupportedForSession(api, runningApp())).toBe(
      false,
    );
  });
});

describe("isContactsOsSupportedForSession", () => {
  it("returns true when the model and OS version meet the minimums", () => {
    const api = createInternalApi(createReadyState());
    expect(isContactsOsSupportedForSession(api)).toBe(true);
  });

  it("returns false on an unsupported device model", () => {
    const api = createInternalApi(
      createReadyState({ modelId: DeviceModelId.NANO_X }),
    );
    expect(isContactsOsSupportedForSession(api)).toBe(false);
  });

  it("returns false when the OS version is below the minimum", () => {
    const api = createInternalApi(
      createReadyState({ osVersion: BELOW_ANY_VERSION }),
    );
    expect(isContactsOsSupportedForSession(api)).toBe(false);
  });

  it("returns false when the device session has no firmware version", () => {
    const api = createInternalApi({
      sessionStateType: DeviceSessionStateType.Connected,
      deviceStatus: DeviceStatus.CONNECTED,
      deviceModelId: DeviceModelId.FLEX,
    });
    expect(isContactsOsSupportedForSession(api)).toBe(false);
  });
});
