export interface ScreenshotSaver {
  /**
   * Save a screenshot. Returns the file path if saved, or null if disabled.
   */
  save(): Promise<string | null>;
}
