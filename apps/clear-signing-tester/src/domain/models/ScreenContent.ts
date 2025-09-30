/**
 * Domain model representing the content displayed on a device screen
 */
export interface ScreenContent {
    readonly text: string;
    readonly timestamp: Date;
    readonly isEmpty: boolean;
}

/**
 * Domain model representing raw screen events (used for parsing)
 */
export interface ScreenEvent {
    readonly text: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
    readonly clear: boolean;
}
