import { type ScreenEvent } from "@root/src/domain/models/ScreenContent";

export interface ScreenReader {
  readRawScreenEvents(): Promise<ScreenEvent[]>;
}
