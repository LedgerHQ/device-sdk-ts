import { Container } from "inversify";

import { type MockServerConfig } from "@api/model/MockServerConfig";
import { apduModuleFactory } from "@internal/apdu/di/apduModuleFactory";
import { appTypes } from "@internal/di/types";
import { osModuleFactory } from "@internal/os/di/osModuleFactory";
import { secureChannelModuleFactory } from "@internal/secure-channel/di/secureChannelModuleFactory";
import { serverModuleFactory } from "@internal/server/di/serverModuleFactory";
import { sessionModuleFactory } from "@internal/session/di/sessionModuleFactory";
import { speculosModuleFactory } from "@internal/speculos/di/speculosModuleFactory";

/** Build the inversify container wired for the given configuration. */
export function makeContainer(config: MockServerConfig): Container {
  const container = new Container();
  container.bind<MockServerConfig>(appTypes.Config).toConstantValue(config);
  container.loadSync(
    sessionModuleFactory(),
    osModuleFactory(),
    secureChannelModuleFactory(),
    apduModuleFactory(),
    speculosModuleFactory(config),
    serverModuleFactory(),
  );
  return container;
}
