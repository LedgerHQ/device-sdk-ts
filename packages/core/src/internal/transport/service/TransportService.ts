import { Either } from "purify-ts";

import { SdkError } from "@api/Error";
import { Transport, TransportIdentifier } from "@api/types";

export interface TransportService {
  addTransport(transport: Transport): Either<SdkError, TransportService>;
  getTransportById(
    transportId: TransportIdentifier,
  ): Either<SdkError, Transport>;
  removeTransport(transportId: TransportIdentifier): TransportService;
  getTransports(): ReadonlyArray<Transport>;
}
