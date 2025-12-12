import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import axios from "axios";
import * as fs from "fs";
import { inject, injectable } from "inversify";
import * as path from "path";

import { TYPES } from "@root/src/di/types";
import { type ScreenshotSaver } from "@root/src/domain/adapters/ScreenshotSaver";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";

@injectable()
export class SpeculosScreenshotSaver implements ScreenshotSaver {
  private readonly speculosUrl: string;
  private readonly logger: LoggerPublisherService;
  private readonly screenshotPath: string | null;
  private counter = 0;

  constructor(
    @inject(TYPES.SpeculosConfig) config: SpeculosConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.speculosUrl = `${config.url}:${config.port}`;
    this.screenshotPath = config.screenshotPath ?? null;
    this.logger = loggerFactory("screenshot-saver");

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

      const response = await axios.get(`${this.speculosUrl}/screenshot`, {
        headers: { accept: "image/png" },
        responseType: "arraybuffer",
      });

      fs.writeFileSync(filePath, response.data);
      this.logger.info(`Saved screenshot: ${filePath}`);

      return filePath;
    } catch (error) {
      this.logger.error("Failed to save screenshot", { data: { error } });
      return null;
    }
  }
}
