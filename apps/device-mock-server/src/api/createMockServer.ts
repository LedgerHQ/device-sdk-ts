import "reflect-metadata";

import {
  type MockServerApp,
  type MockServerConfig,
} from "@api/model/MockServerConfig";
import { makeContainer } from "@internal/di/container";
import { serverTypes } from "@internal/server/di/serverTypes";
import { type HttpAppFactory } from "@internal/server/HttpAppFactory";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { type SessionSweeperService } from "@internal/session/service/SessionSweeperService";

/**
 * Build the mock server: wire the container for `config`, build the Express app
 * and start the expired-session sweeper. Exported so it can be exercised in
 * tests without binding a port.
 */
export function createMockServer(config: MockServerConfig = {}): MockServerApp {
  const container = makeContainer(config);
  const app = container.get<HttpAppFactory>(serverTypes.HttpAppFactory).build();
  const stopSweeper = container
    .get<SessionSweeperService>(sessionTypes.Sweeper)
    .start();
  return { app, close: () => stopSweeper() };
}
