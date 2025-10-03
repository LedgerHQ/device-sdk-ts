import { ScreenEvent } from "../models/ScreenContent";

export interface ScreenReader {
    readRawScreenEvents(): Promise<ScreenEvent[]>;
}
