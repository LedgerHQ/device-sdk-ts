import { Either } from "purify-ts";

import { SdkError } from "@api/Error";
import { TransportBuilder } from "@api/transport/model/TransportBuilder";
import { Transport, TransportIdentifier } from "@api/types";

export interface TransportService {
  addTransport<T extends Transport>(
    transportBuilder: TransportBuilder<T>,
  ): Either<SdkError, TransportService>;
  getTransportById(
    transportId: TransportIdentifier,
  ): Either<SdkError, Transport>;
  removeTransport(transportId: TransportIdentifier): TransportService;
  getTransports(): ReadonlyArray<Transport>;
}
