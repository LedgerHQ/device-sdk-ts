import {
  type LoggerSubscriberService,
  type LogParams,
} from "@ledgerhq/device-management-kit";

import { DEVTOOLS_MODULES, MODULE_CONNECTED_MESSAGE_TYPE } from "../modules";
import { type Connector } from "../types";
import { LOGGER_MESSAGE_TYPES } from "./constants";
import { mapDmkLogToDevToolsLog } from "./mapDmkLogToDevToolsLog";

export class DevToolsLogger implements LoggerSubscriberService {
  constructor(private readonly connector: Connector) {
    // Send handshake to identify this module to the dashboard
    this.connector.sendMessage(
      MODULE_CONNECTED_MESSAGE_TYPE,
      JSON.stringify({ module: DEVTOOLS_MODULES.LOGGER }),
    );
  }

  log(...logParams: LogParams): void {
    this.connector.sendMessage(
      LOGGER_MESSAGE_TYPES.ADD_LOG,
      JSON.stringify(mapDmkLogToDevToolsLog(logParams)),
    );
  }
}
