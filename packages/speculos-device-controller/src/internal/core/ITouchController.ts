import type { PercentPoint } from "./types";

export interface ITouchController<K extends string = string> {
  tapAndRelease: (deviceKey: K, point: PercentPoint) => Promise<void>;
  tap: (deviceKey: K, point: PercentPoint) => Promise<void>;
  release: (deviceKey: K, point: PercentPoint) => Promise<void>;
}
