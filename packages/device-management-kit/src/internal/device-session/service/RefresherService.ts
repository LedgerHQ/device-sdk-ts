import { v4 as uuidv4 } from "uuid";

import { type DeviceSessionRefresher } from "@internal/device-session/model/DeviceSessionRefresher";

export class RefresherService {
  // the refresher should be enabled if and only if the size of this is equal to zero
  private readonly _refresherBlockers = new Set<string>();

  constructor(private readonly _refresher: DeviceSessionRefresher) {}

  public disableRefresher(id: string): () => void {
    const uniqueId = `${id}-${uuidv4()}`;
    this.addRefresherBlocker(uniqueId);

    let hasBeenReenabled = false;

    return () => {
      if (hasBeenReenabled) return;

      hasBeenReenabled = true;
      this.removeRefresherBlocker(uniqueId);
    };
  }

  private addRefresherBlocker(blockerId: string) {
    const prevBlockersCount = this._refresherBlockers.size;
    this._refresherBlockers.add(blockerId);

    if (prevBlockersCount === 0) {
      this._refresher.stop();
    }
  }

  private removeRefresherBlocker(blockerId: string) {
    const prevBlockersCount = this._refresherBlockers.size;
    this._refresherBlockers.delete(blockerId);

    if (prevBlockersCount > 0 && this._refresherBlockers.size === 0) {
      this._refresher.start();
    }
  }
}
