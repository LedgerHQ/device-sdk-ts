import { ContainerModule, type Factory } from "inversify";

import {
    LoggerPublisherService as LoggerPublisherServiceBase,
    LoggerSubscriberService,
} from "@ledgerhq/device-management-kit";
import { TYPES } from "../types";
import { LoggerPublisherService } from "@root/src/services/LoggerPublisherService";

type FactoryProps = {
    subscribers: LoggerSubscriberService[];
};

export const loggerModuleFactory = ({ subscribers }: FactoryProps) =>
    new ContainerModule(({ bind }) => {
        bind<Factory<LoggerPublisherServiceBase>>(
            TYPES.LoggerPublisherServiceFactory,
        ).toFactory((_context) => {
            return (tag: string) =>
                new LoggerPublisherService(subscribers, tag);
        });
    });
