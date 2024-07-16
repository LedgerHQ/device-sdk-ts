import { interfaces } from "inversify";

import { BuiltinTransport } from "@api/transport/model/BuiltinTransport";
import { Transport } from "@api/transport/model/Transport";
import { MockTransport } from "@internal/transport/mockserver/MockserverTransport";
import { WebUsbHidTransport } from "@internal/transport/usb/transport/WebUsbHidTransport";

export class TransportDataSource {
  private static transports: {
    [transport in BuiltinTransport]: interfaces.Newable<Transport>;
  } = {
    [BuiltinTransport.USB]: WebUsbHidTransport,
    [BuiltinTransport.MOCK_SERVER]: MockTransport,
  };

  static get(transport: BuiltinTransport): interfaces.Newable<Transport> {
    return TransportDataSource.transports[transport];
  }
}
