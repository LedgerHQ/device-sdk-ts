import {
  ConsoleLogger,
  type LoggerPublisherService as LoggerPublisherServiceBase,
  type LoggerSubscriberService,
} from "@ledgerhq/device-management-kit";
import { ContainerModule, type Factory } from "inversify";

import { TYPES } from "@root/src/di/types";
import {
  type LoggerConfig,
  parseLogLevel,
} from "@root/src/domain/models/config/LoggerConfig";
import { FileLogger } from "@root/src/services/FileLogger";
import { LoggerPublisherService } from "@root/src/services/LoggerPublisherService";

type FactoryProps = {
  config: LoggerConfig;
};

export const loggerModuleFactory = ({ config }: FactoryProps) => {
  const subscribers: LoggerSubscriberService[] = [];

  const cliLogLevel = parseLogLevel(config.cli.level);
  if (cliLogLevel !== null) {
    subscribers.push(new ConsoleLogger(cliLogLevel));
  }

  if (config.file) {
    const fileLogLevel = parseLogLevel(config.file.level);
    if (fileLogLevel !== null) {
      subscribers.push(new FileLogger(config.file.filePath, fileLogLevel));
    }
  }

  return new ContainerModule(({ bind }) => {
    bind<LoggerSubscriberService[]>(TYPES.LoggerSubscribers).toConstantValue(
      subscribers,
    );

    bind<Factory<LoggerPublisherServiceBase>>(
      TYPES.LoggerPublisherServiceFactory,
    ).toFactory((_context) => {
      return (tag: string) => new LoggerPublisherService(subscribers, tag);
    });
  });
};
