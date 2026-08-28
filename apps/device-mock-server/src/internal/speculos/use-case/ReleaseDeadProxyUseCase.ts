import { inject, injectable } from "inversify";

import { logger } from "@internal/logger/logger";
import {
  type SessionRecord,
  type SpeculosProxySession,
} from "@internal/session/model/SessionModels";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import { type CloseAppUseCase } from "@internal/speculos/use-case/CloseAppUseCase";

/**
 * An app quit from the device screen takes Speculos down with it, so the
 * emulator disappears without any Close App APDU ever reaching the server and
 * the device is left proxying to nothing. Probes the emulator behind a proxy
 * and, when it is gone, closes the app on the device's behalf so it reverts to
 * mock (BOLOS) mode.
 */
@injectable()
export class ReleaseDeadProxyUseCase {
  constructor(
    @inject(speculosTypes.OperatorDataSource)
    private readonly operator: SpeculosOperatorDataSource,
    @inject(speculosTypes.CloseAppUseCase)
    private readonly closeApp: CloseAppUseCase,
  ) {}

  /** @returns whether the emulator was gone and the proxy has been discarded. */
  async execute(
    record: SessionRecord,
    deviceId: string,
    proxy: SpeculosProxySession,
  ): Promise<boolean> {
    if (await this.operator.isAlive(proxy.speculosUrl)) return false;
    // The proxy is forgotten synchronously; releasing the run is best-effort and
    // must not hold up the APDU (or passthrough) waiting on the operator.
    void this.closeApp.execute(record, deviceId, proxy).run();
    logger.info(
      `Speculos ${proxy.runId} is gone (app "${proxy.appName}" quit on the device); ${deviceId} is back in mock mode`,
    );
    return true;
  }
}
