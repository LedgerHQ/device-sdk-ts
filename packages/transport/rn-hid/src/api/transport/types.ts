import {
  type ApduResponse,
  type ConnectError,
  type DmkError,
  type LogLevel,
  type TransportDeviceModel,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

export type Log = {
  level: LogLevel;
  message: string;
  tag: string;
  jsonPayload: Record<string, string>;
};

type ConnectionSuccess = {
  sessionId: string;
  transportDeviceModel: TransportDeviceModel;
};

export type DeviceDisconnected = {
  sessionId: string;
};

export type ConnectionResult = Either<ConnectError, ConnectionSuccess>;

export type SendApduResult = Either<DmkError, ApduResponse>;
