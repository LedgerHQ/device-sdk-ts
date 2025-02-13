import { type Either, type Maybe } from "purify-ts";

import { type TransportAlreadyExistsError } from "@api/index";
import { type Transport, type TransportFactory } from "@api/types";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";

export interface TransportService {
  getTransport(transportId: string): Maybe<Transport>;
  getAllTransports(): Transport[];
  addTransport(
    factory: TransportFactory,
  ): Either<TransportAlreadyExistsError, void>;
  closeAllTransports(deviceSessions: DeviceSession[]): Promise<void>;
}
