/**
 * Device-specific metadata interface
 * Contains coordinates for touchscreen interactions
 */
export interface DeviceMetadata {
    readonly coordinates: {
        readonly signButton: { x: number; y: number };
        readonly rejectButton: { x: number; y: number };
        readonly confirmRejectButton: { x: number; y: number };
        readonly acknowledgeButton: { x: number; y: number };
        readonly navigationNext: { x: number; y: number };
        readonly navigationPrevious: { x: number; y: number };
    };
}

/**
 * Base abstract class for device metadata implementations
 */
export abstract class BaseDeviceMetadata implements DeviceMetadata {
    abstract readonly coordinates: DeviceMetadata["coordinates"];
}
