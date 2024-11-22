import { type Either, type Maybe } from "purify-ts";

import { type TransportAlreadyExistsError } from "@api/index";
import { type Transport, type TransportFactory } from "@api/types";

export interface TransportService {
  getTransport(transportId: string): Maybe<Transport>;
  getAllTransports(): Transport[];
  addTransport(
    factory: TransportFactory,
  ): Either<TransportAlreadyExistsError, void>;
}
