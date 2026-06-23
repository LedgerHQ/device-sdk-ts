import { inject, injectable, optional } from "inversify";

import { type MockServerConfig } from "@api/model/MockServerConfig";
import { appTypes } from "@internal/di/types";
import { logger } from "@internal/logger/logger";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";

const DEFAULT_SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Periodically removes expired sessions, releasing any Speculos instances they
 * still hold.
 */
@injectable()
export class SessionSweeperService {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @inject(appTypes.Config)
    private readonly config: MockServerConfig,
    @optional()
    @inject(speculosTypes.OperatorDataSource)
    private readonly operator?: SpeculosOperatorDataSource,
  ) {}

  /** Start the sweeper; returns a function that stops it. */
  start(): () => void {
    const interval = this.config.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
    if (interval <= 0) return () => {};
    const timer = setInterval(() => {
      const evicted = this.repository.sweep();
      for (const proxy of evicted) {
        void this.operator?.release(proxy.runId).run();
      }
      if (evicted.length > 0) {
        logger.debug(
          `Swept expired session(s), released ${evicted.length} speculos instance(s)`,
        );
      }
    }, interval);
    timer.unref?.();
    return () => clearInterval(timer);
  }
}
