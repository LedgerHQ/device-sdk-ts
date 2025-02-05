export enum SecureChannelOperationEnum {
  GenuineCheck = "GenuineCheck",
  ListInstalledApps = "ListInstalledApps",
  UpdateMcu = "UpdateMcu",
  UpdateFirmware = "UpdateFirmware",
  InstallApp = "InstallApp",
  UninstallApp = "UninstallApp",
}

/**
 * The message that will be received from the server by the secure channel.
 */
export type InMessageType = {
  uuid: string;
  session: string;
  query: InMessageQueryEnum;
  nonce: number;
  data: string | Array<string>;
  result?: unknown;
};

export enum InMessageQueryEnum {
  EXCHANGE = "exchange",
  BULK = "bulk",
  ERROR = "error",
  WARNING = "warning",
  SUCCESS = "success",
}

/**
 * The message that will be sent to the server by the secure channel.
 */
export type OutMessageType = {
  nonce: number;
  response: OutMessageResponseEnum;
  data: string;
};

export enum OutMessageResponseEnum {
  SUCCESS = "success",
  ERROR = "error",
}

/**
 * The all event types that can be emitted to the client by the secure channel.
 *
 */
export enum SecureChannelEventType {
  Opened = "opened",
  Closed = "closed",
  PermissionRequested = "permission-requested",
  PermissionGranted = "permission-granted",
  PreExchange = "pre-exchange",
  Exchange = "exchange",
  Progress = "progress",
  Warning = "warning",
  Result = "result",
}

/**
 * The possible payload that will be sent to the client when a secure channel event occurs.
 */
export type SecureChannelEventPayload = {
  PreExchange: { nonce: number; apdu: Uint8Array };
  Exchange: {
    nonce: number;
    apdu: Uint8Array;
    data: Uint8Array;
    status: Uint8Array;
  };
  Progress: { progress: number; index: number; total: number };
  Warning: { message: string };
  Result: unknown;
};

/**
 * The event type that will be emitted to the client when a secure channel event occurs.
 */
export type SecureChannelEvent =
  | {
      type: SecureChannelEventType.Opened;
    }
  | {
      type: SecureChannelEventType.Closed;
    }
  | {
      type: SecureChannelEventType.PermissionRequested;
    }
  | {
      type: SecureChannelEventType.PermissionGranted;
    }
  | {
      type: SecureChannelEventType.PreExchange;
      payload: SecureChannelEventPayload["PreExchange"];
    }
  | {
      type: SecureChannelEventType.Exchange;
      payload: SecureChannelEventPayload["Exchange"];
    }
  | {
      type: SecureChannelEventType.Progress;
      payload: SecureChannelEventPayload["Progress"];
    }
  | {
      type: SecureChannelEventType.Warning;
      payload: SecureChannelEventPayload["Warning"];
    }
  | {
      type: SecureChannelEventType.Result;
      payload: SecureChannelEventPayload["Result"];
    };
