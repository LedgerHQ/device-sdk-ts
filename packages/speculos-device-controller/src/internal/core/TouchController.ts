import type { PercentCoordinates } from "./types";

export interface TouchController<K extends string = string> {
  tapAndRelease: (deviceKey: K, point: PercentCoordinates) => Promise<void>;
  tap: (deviceKey: K, point: PercentCoordinates) => Promise<void>;
  release: (deviceKey: K, point: PercentCoordinates) => Promise<void>;
}
