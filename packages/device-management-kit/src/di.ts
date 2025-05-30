import { Container } from "inversify";

import { commandModuleFactory } from "@api/command/di/commandModule";
import { deviceActionModuleFactory } from "@api/device-action/di/deviceActionModule";
import { type DmkConfig } from "@api/DmkConfig";
import { type LoggerSubscriberService } from "@api/logger-subscriber/service/LoggerSubscriberService";
import { type TransportFactory } from "@api/transport/model/Transport";
import { configModuleFactory } from "@internal/config/di/configModule";
import { deviceModelModuleFactory } from "@internal/device-model/di/deviceModelModule";
import { deviceSessionModuleFactory } from "@internal/device-session/di/deviceSessionModule";
import { discoveryModuleFactory } from "@internal/discovery/di/discoveryModule";
import { loggerModuleFactory } from "@internal/logger-publisher/di/loggerModule";
import { managerApiModuleFactory } from "@internal/manager-api/di/managerApiModule";
import {
  DEFAULT_FIRMWARE_DISTRIBUTION_SALT,
  DEFAULT_MANAGER_API_BASE_URL,
  DEFAULT_MOCK_SERVER_BASE_URL,
  DEFAULT_PROVIDER,
} from "@internal/manager-api/model/Const";
import { secureChannelModuleFactory } from "@internal/secure-channel/di/secureChannelModule";
import { DEFAULT_WEB_SOCKET_BASE_URL } from "@internal/secure-channel/model/Const";
import { sendModuleFactory } from "@internal/send/di/sendModule";
import { transportModuleFactory } from "@internal/transport//di/transportModule";

export type MakeContainerProps = {
  stub: boolean;
  transports: TransportFactory[];
  loggers: LoggerSubscriberService[];
  config: DmkConfig;
};

export const makeContainer = ({
  stub = false,
  transports = [],
  loggers = [],
  config = {
    mockUrl: DEFAULT_MOCK_SERVER_BASE_URL,
    managerApiUrl: DEFAULT_MANAGER_API_BASE_URL,
    webSocketUrl: DEFAULT_WEB_SOCKET_BASE_URL,
    provider: DEFAULT_PROVIDER,
    firmwareDistributionSalt: DEFAULT_FIRMWARE_DISTRIBUTION_SALT,
  },
}: Partial<MakeContainerProps>) => {
  const container = new Container();

  container.loadSync(
    configModuleFactory({ stub }),
    deviceModelModuleFactory({ stub }),
    transportModuleFactory({ stub, transports, config }),
    managerApiModuleFactory({ stub, config }),
    secureChannelModuleFactory({ stub, config }),
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
