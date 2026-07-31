import {
  DmkNetworkClient,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import * as fs from "fs";
import { inject, injectable } from "inversify";
import * as path from "path";

import { TYPES } from "@root/src/di/types";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
import { getEmulatorBaseUrl } from "@root/src/domain/utils/getEmulatorBaseUrl";

@injectable()
export class SpeculosScreenshotSaver implements ScreenshotSaver {
  private readonly config: SpeculinhoConfig;
  private readonly logger: LoggerPublisherService;
  private readonly screenshotPath: string | null;
  private readonly http: DmkNetworkClient;
  private counter = 0;

  constructor(
    @inject(TYPES.SpeculinhoConfig) config: SpeculinhoConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.config = config;
    this.screenshotPath = config.screenshotPath ?? null;
    this.logger = loggerFactory("screenshot-saver");
    this.http = new DmkNetworkClient();

    if (config.screenshotPath && !fs.existsSync(config.screenshotPath)) {
      throw new Error(
        `Screenshot path does not exist: ${config.screenshotPath}`,
      );
    }
  }

  async save(): Promise<string | null> {
    if (!this.screenshotPath) {
      return null;
    }

    // wait a little bit to let speculos update the screen
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      this.counter++;
      const filename = `screenshot_${this.counter}.png`;
      const filePath = path.join(this.screenshotPath, filename);

      const arrayBuffer = (await this.http.get(
        `${getEmulatorBaseUrl(this.config)}/screenshot`,
        {
          headers: { accept: "image/png" },
          responseType: "arrayBuffer",
        },
      )) as ArrayBuffer;
      const buffer = Buffer.from(arrayBuffer);

      fs.writeFileSync(filePath, buffer);
      this.logger.info(`Saved screenshot: ${filePath}`);

      return filePath;
    } catch (error) {
      this.logger.error("Failed to save screenshot", { data: { error } });
      return null;
    }
  }
}
