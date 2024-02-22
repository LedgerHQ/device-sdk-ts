import { Container } from "inversify";

import { LoggerSubscriber } from "@api/logger-subscriber/service/LoggerSubscriber";
// Uncomment this line to enable the logger middleware
// import { makeLoggerMiddleware } from "inversify-logger-middleware";
import { configModuleFactory } from "@internal/config/di/configModule";
import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { discoveryModuleFactory } from "@internal/discovery/di/discoveryModule";
import { loggerModuleFactory } from "@internal/logger/di/loggerModule";
import { usbModuleFactory } from "@internal/usb/di/usbModule";

// Uncomment this line to enable the logger middleware
// const logger = makeLoggerMiddleware();

export type MakeContainerProps = {
  stub: boolean;
  loggers: LoggerSubscriber[];
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
    // modules go here
  );

  return container;
};
