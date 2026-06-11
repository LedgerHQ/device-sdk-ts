import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { exactly, oneOf } from "purify-ts";

/**
 * Set of device models supported by the clear-signing and transaction-check
 * flows. Excludes `NANO_S` and `APEX`.
 */
export const deviceModelIdCodec = oneOf([
  exactly(DeviceModelId.NANO_X),
  exactly(DeviceModelId.NANO_SP),
  exactly(DeviceModelId.STAX),
  exactly(DeviceModelId.FLEX),
]);
