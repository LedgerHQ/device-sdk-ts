/**
 * Pause between two cases that share one emulator, letting the device settle
 * before the next signing flow starts.
 *
 * Owed only *between* cases. A split scenario gets a fresh pod per case, so
 * pausing after the last one would hold an emulator for nothing.
 */
export const INTER_CASE_DELAY_MS = 2000;

export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
