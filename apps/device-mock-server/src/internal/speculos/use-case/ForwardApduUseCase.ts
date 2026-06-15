import { inject, injectable } from "inversify";
import { type EitherAsync } from "purify-ts";

import { type SpeculosProxySession } from "@internal/session/model/SessionModels";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import { type SpeculosError } from "@internal/speculos/model/SpeculosModels";

/** Forward a raw APDU to the device's live Speculos instance. */
@injectable()
export class ForwardApduUseCase {
  constructor(
    @inject(speculosTypes.OperatorDataSource)
    private readonly operator: SpeculosOperatorDataSource,
  ) {}

  execute(
    proxy: SpeculosProxySession,
    apduHex: string,
  ): EitherAsync<SpeculosError, string> {
    return this.operator.forwardApdu(proxy.speculosUrl, apduHex);
  }
}
