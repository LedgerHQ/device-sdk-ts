import { Container } from "inversify";
import { makeLoggerMiddleware } from "inversify-logger-middleware";

import { configModuleFactory } from "@internal/config/di/configModule";

const logger = makeLoggerMiddleware();

export type MakeContainerProps = {
  stub: boolean;
};
export const makeContainer = ({
  stub = false,
}: Partial<MakeContainerProps> = {}) => {
  const container = new Container();
  container.applyMiddleware(logger);
  container.load(
    configModuleFactory({ stub }),
    // modules go here
  );

  return container;
};
