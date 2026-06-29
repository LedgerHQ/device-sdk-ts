import {
  type ConnectedDevice,
  type DeviceSessionState,
  DeviceSessionStateType,
  StaticDeviceModelDataSource,
} from "@ledgerhq/device-management-kit";
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

type ConnectivityType = ConnectedDevice["type"];

const DASHBOARD_APP_NAME = "BOLOS";
const deviceModelDataSource = new StaticDeviceModelDataSource();

function firmwareVersionFromState(state: DeviceSessionState): string {
  if ("firmwareVersion" in state && state.firmwareVersion?.os) {
    return state.firmwareVersion.os;
  }
  if ("currentApp" in state && state.currentApp?.name === DASHBOARD_APP_NAME) {
    return state.currentApp.version;
  }
  return "";
}

/**
 * Builds a partial mock-server device config from a DMK device session state.
 *
 * The mock server's `device_type` values match the `DeviceModelId` enum values
 * (e.g. "nanoX", "stax"), so the model id is used directly. The `name` is the
 * commercial model name (e.g. "Flex", "Gen 5"). The optional `connectivityType`
 * ("USB" / "BLE") comes from the connected device. The `firmware_version` (SE
 * version) is always present, defaulting to an empty string until the session
 * is ready. The running app is only available once the session is ready.
 */
export function deviceConfigFromSession(
  state?: DeviceSessionState,
  connectivityType?: ConnectivityType,
): Partial<DeviceConfig> {
  if (!state) {
    return {};
  }

  const firmwareVersion = firmwareVersionFromState(state);
  const deviceModel = deviceModelDataSource.getDeviceModel({
    id: state.deviceModelId,
  });

  const base: Partial<DeviceConfig> = {
    name: deviceModel.productName,
    device_type: state.deviceModelId,
    ...(connectivityType ? { connectivity_type: connectivityType } : {}),
    firmware_version: firmwareVersion,
  };

  if (state.sessionStateType === DeviceSessionStateType.Connected) {
    return base;
  }

  return {
    ...base,
    // The dashboard (BOLOS) is not an installed app, so it is never listed.
    ...(state.currentApp && state.currentApp.name !== DASHBOARD_APP_NAME
      ? {
          apps: [
            { name: state.currentApp.name, version: state.currentApp.version },
          ],
        }
      : {}),
  };
}
