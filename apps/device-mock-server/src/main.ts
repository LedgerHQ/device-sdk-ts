import "reflect-metadata";

import { createMockServer } from "@api/createMockServer";
import { type MockServerConfig } from "@api/model/MockServerConfig";
import { logger } from "@internal/logger/logger";

const port = Number(process.env["PORT"] ?? 9752);

/**
 * Speculinho is enabled by default against the labs operator; set
 * `SPECULINHO_URL=` (empty) to run as a pure mock with no Speculos proxying.
 */
const speculinhoUrl =
  process.env["SPECULINHO_URL"] ?? "https://speculinho.ledgerlabs.net";

const speculos: MockServerConfig["speculos"] = speculinhoUrl
  ? {
      baseUrl: speculinhoUrl,
      speculosVersion: process.env["SPECULOS_VERSION"],
      readyTimeoutMs: process.env["SPECULOS_READY_TIMEOUT_MS"]
        ? Number(process.env["SPECULOS_READY_TIMEOUT_MS"])
        : undefined,
    }
  : undefined;

const { app, attachWebSocket } = createMockServer({ speculos });

const server = app.listen(port, () => {
  const baseUrl = `http://127.0.0.1:${port}`;
  logger.info(`Device mock server listening on ${baseUrl}`);
  logger.info(`Health check available at ${baseUrl}/health`);
  logger.info(
    `Secure channel WebSocket at ws://127.0.0.1:${port}/secure-channel`,
  );
  if (speculos) {
    logger.info(`Speculos proxy via Speculinho at ${speculos.baseUrl}`);
  }
});

attachWebSocket(server);
