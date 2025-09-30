import axios from "axios";
import { inject, injectable } from "inversify";
import { ScreenEvent } from "../../domain/models/ScreenContent";
import { type DeviceConnectionConfig } from "../../domain/repositories/DeviceRepository";
import { TYPES } from "../../di/types";
import { LoggerPublisherService } from "@ledgerhq/device-management-kit";

/**
 * Speculos implementation of screen reading functionality
 * Pure adapter that handles HTTP communication with Speculos API
 * Contains no business logic - only technical communication concerns
 */
@injectable()
export class SpeculosScreenReader {
    private readonly speculosUrl: string;
    private readonly logger: LoggerPublisherService;

    constructor(
        @inject(TYPES.DeviceConnectionConfig) config: DeviceConnectionConfig,
        @inject(TYPES.LoggerPublisherServiceFactory)
        loggerFactory: (tag: string) => LoggerPublisherService,
    ) {
        this.speculosUrl = config.speculosUrl;
        this.logger = loggerFactory("screen-reader");
    }

    /**
     * Read raw screen events from Speculos API
     * Returns domain objects with no business logic applied
     */
    async readRawScreenEvents(): Promise<ScreenEvent[]> {
        try {
            const response = await axios.get(
                `${this.speculosUrl}/events?stream=false&currentscreenonly=true`,
            );

            const rawEvents = response.data.events || [];

            // Convert raw API events to domain events
            const screenEvents: ScreenEvent[] = rawEvents.map((event: any) => ({
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
            this.logger.error(
                "Failed to read raw screen events from Speculos",
                {
                    data: { error },
                },
            );
            return [];
        }
    }
}
