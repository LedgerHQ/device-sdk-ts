import {
  type DeviceScreenModel as BaseDeviceScreenModel,
  findDeviceScreenModel as findBaseDeviceScreenModel,
} from "@ledgerhq/device-mockserver-react-core";
import { Flex, Nano, NanoGen5, Stax } from "@ledgerhq/lumen-ui-react/symbols";

export interface DeviceScreenModel extends BaseDeviceScreenModel {
  readonly icon: typeof Nano;
}

/** Keyed by the mock server's `device_type`; every Nano draws as one. */
const ICONS: Record<string, typeof Nano> = {
  stax: Stax,
  flex: Flex,
  apexp: NanoGen5,
};

export const findDeviceScreenModel = (
  deviceType: string,
): DeviceScreenModel => ({
  ...findBaseDeviceScreenModel(deviceType),
  icon: ICONS[deviceType] ?? Nano,
});
