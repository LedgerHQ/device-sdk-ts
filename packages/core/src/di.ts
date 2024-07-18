import { Container } from "inversify";

// Uncomment this line to enable the logger middleware
// import { makeLoggerMiddleware } from "inversify-logger-middleware";
import { commandModuleFactory } from "@api/command/di/commandModule";
import { deviceActionModuleFactory } from "@api/device-action/di/deviceActionModule";
import { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import { Transport } from "@api/transport/model/Transport";
import { BuiltinTransports } from "@api/transport/model/TransportIdentifier";
// Uncomment this line to enable the logger middleware
// import { makeLoggerMiddleware } from "inversify-logger-middleware";
import { SdkConfig } from "@api/SdkConfig";
import { configModuleFactory } from "@internal/config/di/configModule";
import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { discoveryModuleFactory } from "@internal/discovery/di/discoveryModule";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";
import { managerApiModuleFactory } from "@internal/manager-api/di/managerApiModule";
import { DEFAULT_MANAGER_API_BASE_URL } from "@internal/manager-api/model/Const";
import { sendModuleFactory } from "@internal/send/di/sendModule";
import { transportModuleFactory } from "@internal/transport//di/transportModule";
import { usbModuleFactory } from "@internal/transport/usb/di/usbModule";

// Uncomment this line to enable the logger middleware
// const logger = makeLoggerMiddleware();

export type MakeContainerProps = {
  stub: boolean;
  transports: BuiltinTransports[];
  customTransports: Transport[];
  loggers: LoggerSubscriberService[];
  config: SdkConfig;
};

export const makeContainer = ({
  stub = false,
  transports = [],
  customTransports = [],
  loggers = [],
  config = { managerApiUrl: DEFAULT_MANAGER_API_BASE_URL },
}: MakeContainerProps) => {
  const container = new Container();

  // Uncomment this line to enable the logger middleware
  // container.applyMiddleware(logger);

  container.load(
    configModuleFactory({ stub }),
    deviceModelModuleFactory({ stub }),
    transportModuleFactory({ stub, transports, customTransports, config }),
    usbModuleFactory({ stub }),
    managerApiModuleFactory({ stub, config }),
    discoveryModuleFactory({ stub }),
    loggerModuleFactory({ subscribers: loggers }),
    deviceSessionModuleFactory({ stub }),
    sendModuleFactory({ stub }),
    commandModuleFactory({ stub }),
    deviceActionModuleFactory({ stub }),
    // modules go here
  );

  return container;
};
