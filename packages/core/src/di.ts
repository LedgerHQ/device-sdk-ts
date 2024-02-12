import { Container } from "inversify";

// Uncomment this line to enable the logger middleware
// import { makeLoggerMiddleware } from "inversify-logger-middleware";
import { configModuleFactory } from "@internal/config/di/configModule";
import { loggerModuleFactory } from "@internal/logger/di/loggerModule";
import { LoggerSubscriber } from "@internal/logger/service/Log";

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
    loggerModuleFactory({ subscribers: loggers }),
    // modules go here
  );

  return container;
};
