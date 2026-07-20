import { type Device } from "@ledgerhq/device-mockserver-client";
import { inject, injectable } from "inversify";
import { EitherAsync } from "purify-ts";

import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import {
  type SessionRecord,
  type SpeculosProxySession,
} from "@internal/session/model/SessionModels";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import {
  type OpenAppError,
  type SpeculosError,
} from "@internal/speculos/model/SpeculosModels";
import {
  buildRunId,
  mapCoinApp,
  mapDeviceModel,
} from "@internal/speculos/util/openApp";

/**
 * Provisions a Speculos instance for an Open App command and records the proxy
 * on the device, or fails with a typed {@link OpenAppError}.
 */
@injectable()
export class OpenAppViaSpeculosUseCase {
  constructor(
    @inject(speculosTypes.OperatorDataSource)
    private readonly operator: SpeculosOperatorDataSource,
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
  ) {}

  execute(
    record: SessionRecord,
    device: Device,
    appName: string,
  ): EitherAsync<OpenAppError, SpeculosProxySession> {
    return EitherAsync(async ({ throwE }) => {
      const app = device.apps?.find(
        (entry) => entry.name.toLowerCase() === appName.toLowerCase(),
      );
      if (!app) return throwE({ _tag: "AppNotInstalled" });

      const model = mapDeviceModel(device.device_type);
      if (!model || !device.firmware_version) {
        return throwE({
          _tag: "DeviceMisconfigured",
          reason: `unsupported model "${device.device_type}" or missing firmware_version`,
        });
      }

      const coinApp = mapCoinApp(appName);
      const runId = buildRunId(coinApp, model);
      const ready = await this.operator
        .acquire(
          {
            coin_app: coinApp,
            coin_app_version: app.version,
            device: model,
            device_os_version: device.firmware_version,
          },
          runId,
          record.seed,
        )
        .chain(() => this.operator.waitUntilReady(runId))
        .run();

      return ready.caseOf({
        Left: (error: SpeculosError) => {
          void this.operator.release(runId).run();
          return throwE({ _tag: "OperatorError", error });
        },
        Right: (speculosUrl: string) => {
          const session: SpeculosProxySession = { runId, speculosUrl, appName };
          this.repository.setProxy(record, device.id, session);
          return session;
        },
      });
    });
  }
}
