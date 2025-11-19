import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import axios from "axios";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { type ScreenEvent } from "@root/src/domain/models/ScreenContent";

/**
 * Speculos implementation of screen reading functionality
 * Pure adapter that handles HTTP communication with Speculos API
 * Contains no business logic - only technical communication concerns
 */
@injectable()
export class SpeculosScreenReader implements ScreenReader {
  private readonly speculosUrl: string;
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(TYPES.SpeculosConfig) config: SpeculosConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.speculosUrl = `${config.url}:${config.port}`;
    this.logger = loggerFactory("screen-reader");
  }

  /**
   * Read raw screen events from Speculos API
   * Returns domain objects with no business logic applied
   */
  async readRawScreenEvents(): Promise<ScreenEvent[]> {
    try {
      const response = await axios.get<{ events: ScreenEvent[] }>(
        `${this.speculosUrl}/events?stream=false&currentscreenonly=true`,
      );

      const rawEvents = response.data.events || [];

      // Convert raw API events to domain events
      const screenEvents: ScreenEvent[] = rawEvents.map((event) => ({
        text: event.text || "",
        x: event.x || 0,
        y: event.y || 0,
        w: event.w || 0,
        h: event.h || 0,
        clear: event.clear || false,
      }));

      this.logger.debug(`Read ${screenEvents.length} raw screen events`);
      return screenEvents;
    } catch (error) {
      this.logger.error("Failed to read raw screen events from Speculos", {
        data: { error },
      });
      return [];
    }
  }
}
