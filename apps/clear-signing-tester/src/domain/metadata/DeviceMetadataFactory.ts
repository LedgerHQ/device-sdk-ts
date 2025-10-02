import { DeviceMetadata } from "./DeviceMetadata";
import {
    StaxDeviceMetadata,
    FlexDeviceMetadata,
    ApexDeviceMetadata,
} from "./TouchscreenDeviceMetadata";

export type TouchscreenDevice = "stax" | "flex" | "apex";

/**
 * Factory for creating device-specific metadata instances
 * Returns the appropriate metadata based on device type
 */
export class DeviceMetadataFactory {
    /**
     * Creates device metadata for touchscreen devices
     * @param deviceType The type of touchscreen device
     * @returns Device-specific metadata instance
     * @throws Error if device type is not supported for touchscreen
     */
    static createTouchscreenMetadata(
        deviceType: TouchscreenDevice,
    ): DeviceMetadata {
        switch (deviceType) {
            case "stax":
                return new StaxDeviceMetadata();
            case "flex":
                return new FlexDeviceMetadata();
            case "apex":
                return new ApexDeviceMetadata();
            default:
                const uncoveredType: never = deviceType;
                throw new Error(
                    `Unsupported touchscreen device type: ${uncoveredType}`,
                );
        }
    }

    /**
     * Checks if a device type supports touchscreen interactions
     * @param deviceType The device type to check
     * @returns True if device supports touchscreen
     */
    static isTouchscreenDevice(
        deviceType: string,
    ): deviceType is TouchscreenDevice {
        return ["stax", "flex", "apex"].includes(deviceType);
    }
}
