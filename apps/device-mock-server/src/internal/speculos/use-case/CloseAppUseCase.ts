import { inject, injectable } from "inversify";
import { type EitherAsync } from "purify-ts";

import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import {
  type SessionRecord,
  type SpeculosProxySession,
} from "@internal/session/model/SessionModels";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import { type SpeculosError } from "@internal/speculos/model/SpeculosModels";

/**
 * Close the app: forget the device's proxy and release the Speculos instance,
 * reverting the device to mock mode.
 */
@injectable()
export class CloseAppUseCase {
  constructor(
    @inject(speculosTypes.OperatorDataSource)
    private readonly operator: SpeculosOperatorDataSource,
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
  ) {}

  execute(
    record: SessionRecord,
    deviceId: string,
    proxy: SpeculosProxySession,
  ): EitherAsync<SpeculosError, void> {
    this.repository.deleteProxy(record, deviceId);
    return this.operator.release(proxy.runId);
  }
}
