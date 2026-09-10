import {
  DmkNetworkClient,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type ScreenReader } from "@root/src/domain/adapters/ScreenReader";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";
import { type ScreenEvent } from "@root/src/domain/models/ScreenContent";
import { getEmulatorBaseUrl } from "@root/src/domain/utils/getEmulatorBaseUrl";

/**
 * Speculos implementation of screen reading functionality
 * Pure adapter that handles HTTP communication with Speculos API
 * Contains no business logic - only technical communication concerns
 */
@injectable()
export class SpeculosScreenReader implements ScreenReader {
  private readonly config: SpeculinhoConfig;
  private readonly logger: LoggerPublisherService;
  private readonly http: DmkNetworkClient;

  constructor(
    @inject(TYPES.SpeculinhoConfig) config: SpeculinhoConfig,
    @inject(TYPES.LoggerPublisherServiceFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.config = config;
    this.logger = loggerFactory("screen-reader");
    this.http = new DmkNetworkClient();
  }

  /**
   * Read raw screen events from Speculos API
   * Returns domain objects with no business logic applied
   */
  async readRawScreenEvents(): Promise<ScreenEvent[]> {
    try {
      const data = (await this.http.get(
        `${getEmulatorBaseUrl(this.config)}/events`,
        {
          params: { stream: false, currentscreenonly: true },
        },
      )) as { events: ScreenEvent[] };

      const rawEvents = data.events || [];

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
    } catch (_) {
      this.logger.error("Failed to read raw screen events from Speculos");
      return [];
    }
  }
}
