import { BaseDeviceMetadata } from "./DeviceMetadata";

/**
 * Stax device metadata with touchscreen coordinates
 * Based on Stax device specifications and UI layout
 */
export class StaxDeviceMetadata extends BaseDeviceMetadata {
    readonly coordinates = {
        signButton: { x: 350, y: 550 },
        rejectButton: { x: 80, y: 620 },
        confirmRejectButton: { x: 200, y: 550 },
        acknowledgeButton: { x: 200, y: 620 },
        navigationNext: { x: 350, y: 600 },
        navigationPrevious: { x: 180, y: 600 },
    };
}

/**
 * Flex device metadata with touchscreen coordinates
 * Flex has similar touchscreen interface to Stax but may have different dimensions
 */
export class FlexDeviceMetadata extends BaseDeviceMetadata {
    // TODO: Update these coordinates
    readonly coordinates = {
        signButton: { x: 0, y: 0 },
        rejectButton: { x: 0, y: 0 },
        confirmRejectButton: { x: 0, y: 0 },
        acknowledgeButton: { x: 0, y: 0 },
        navigationNext: { x: 0, y: 0 },
        navigationPrevious: { x: 0, y: 0 },
    };
}

/**
 * Apex device metadata with touchscreen coordinates
 * Apex is a newer touchscreen device that may have different coordinate system
 */
export class ApexDeviceMetadata extends BaseDeviceMetadata {
    readonly coordinates = {
        // TODO: Update these coordinates
        signButton: { x: 0, y: 0 },
        rejectButton: { x: 0, y: 0 },
        confirmRejectButton: { x: 0, y: 0 },
        acknowledgeButton: { x: 0, y: 0 },
        navigationNext: { x: 0, y: 0 },
        navigationPrevious: { x: 0, y: 0 },
    };
}
