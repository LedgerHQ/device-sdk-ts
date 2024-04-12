import { Container } from "inversify";

import { LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
// Uncomment this line to enable the logger middleware
// import { makeLoggerMiddleware } from "inversify-logger-middleware";
import { configModuleFactory } from "@internal/config/di/configModule";
import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { discoveryModuleFactory } from "@internal/discovery/di/discoveryModule";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";
import { sendModuleFactory } from "@internal/send/di/sendModule";
import { usbModuleFactory } from "@internal/usb/di/usbModule";

// Uncomment this line to enable the logger middleware
// const logger = makeLoggerMiddleware();

export type MakeContainerProps = {
  stub: boolean;
  loggers: LoggerSubscriberService[];
};

export const makeContainer = ({
  stub = false,
  loggers = [],
}: Partial<MakeContainerProps>) => {
  const container = new Container();

  // Uncomment this line to enable the logger middleware
  // container.applyMiddleware(logger);

  container.load(
    configModuleFactory({ stub }),
    deviceModelModuleFactory({ stub }),
    usbModuleFactory({ stub }),
    discoveryModuleFactory({ stub }),
    loggerModuleFactory({ subscribers: loggers }),
    deviceSessionModuleFactory(),
    sendModuleFactory({ stub }),
    // modules go here
  );

  return container;
};
