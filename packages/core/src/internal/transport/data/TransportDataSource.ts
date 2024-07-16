import { interfaces } from "inversify";

import { Transport } from "@api/transport/model/Transport";
import { BuiltinTransports } from "@api/transport/model/TransportIdentifier";
import { MockTransport } from "@internal/transport/mockserver/MockserverTransport";
import { WebUsbHidTransport } from "@internal/transport/usb/transport/WebUsbHidTransport";

export class TransportDataSource {
  private static transports: {
    [transport in BuiltinTransports]: interfaces.Newable<Transport>;
  } = {
    [BuiltinTransports.USB]: WebUsbHidTransport,
    [BuiltinTransports.MOCK_SERVER]: MockTransport,
  };

  static get(transport: BuiltinTransports): interfaces.Newable<Transport> {
    return TransportDataSource.transports[transport];
  }
}
