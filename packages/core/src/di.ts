import { Container } from "inversify";
import { makeLoggerMiddleware } from "inversify-logger-middleware";
import "reflect-metadata";
import configModuleFactory from "./internal/config/di/configModule";

const logger = makeLoggerMiddleware();

export const makeContainer = (mock = false) => {
  const container = new Container();
  container.applyMiddleware(logger);
  container.load(configModuleFactory(mock));

  return container;
};
