import {
  type ConnectError,
  type TransportDeviceModel,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

type InternalConnectionSuccess = {
  sessionId: string;
  transportDeviceModel: TransportDeviceModel;
};

export type InternalConnectionResult = Either<
  ConnectError,
  InternalConnectionSuccess
>;

export type InternalDeviceDisconnected = {
  sessionId: string;
};
