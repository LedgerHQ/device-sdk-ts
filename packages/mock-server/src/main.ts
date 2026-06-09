import { logger } from "./logger";
import { createMockServer } from "./MockServer";

const port = Number(process.env["PORT"] ?? 8080);

const { app } = createMockServer();

app.listen(port, () => {
  const baseUrl = `http://127.0.0.1:${port}`;
  logger.info(`Device mock server listening on ${baseUrl}`);
  logger.info(`Health check available at ${baseUrl}/health`);
});
