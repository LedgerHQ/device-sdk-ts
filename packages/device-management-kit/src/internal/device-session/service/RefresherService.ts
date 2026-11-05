import { v4 as uuidv4 } from "uuid";

import { getLogger } from "@api/global/services/logger/utils/getLogger";
import { type LoggerPublisherService } from "@api/types";

export interface RefresherController {
  start(): void;
  stop(): void;
}

export class RefresherService {
  private readonly _refresherBlockers = new Set<string>();
  private readonly _logger: LoggerPublisherService;

  constructor(private readonly _refresher: RefresherController) {
    this._logger = getLogger("refresher-service");
  }

  public disableRefresher(id: string): () => void {
    const uniqueId = `${id}-${uuidv4()}`;
    this.addRefresherBlocker(uniqueId);

    this._logger.debug("Refresher disabled", {
      data: {
        blockerId: uniqueId,
        blockers: Array.from(this._refresherBlockers),
      },
    });

    let hasBeenReenabled = false;

    return () => {
      if (hasBeenReenabled) return;
      hasBeenReenabled = true;
      this.removeRefresherBlocker(uniqueId);

      this._logger.debug("Refresher re-enabled", {
        data: {
          blockerId: uniqueId,
          blockers: Array.from(this._refresherBlockers),
        },
      });
    };
  }

  private addRefresherBlocker(blockerId: string): void {
    const prevBlockersCount = this._refresherBlockers.size;
    this._refresherBlockers.add(blockerId);

    if (prevBlockersCount === 0) {
      this._refresher.stop();
    }
  }

  private removeRefresherBlocker(blockerId: string): void {
    const prevBlockersCount = this._refresherBlockers.size;
    this._refresherBlockers.delete(blockerId);

    if (prevBlockersCount > 0 && this._refresherBlockers.size === 0) {
      this._refresher.start();
    }
  }
}
