import {
  type DeviceConnection,
  type SendApduFnType,
} from "@ledgerhq/device-management-kit";
import { Left } from "purify-ts";

import { HidTransportNotSupportedError } from "@api/model/Errors";

export class RNHidDeviceConnection implements DeviceConnection {
  sendApdu: SendApduFnType = () =>
    Promise.resolve(Left(new HidTransportNotSupportedError()));
}
