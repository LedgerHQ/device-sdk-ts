import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type AddressOptions } from "@api/model/AddressOptions";
import { type SignerBtc } from "@api/SignerBtc";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { type GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";

import { makeContainer } from "./di";

type DefaultSignerBtcConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerBtc implements SignerBtc {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerBtcConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getExtendedPublicKey(
    derivationPath: string,
    { checkOnDevice = false }: AddressOptions,
  ) {
    return this._container
      .get<GetExtendedPublicKeyUseCase>(
        useCasesTypes.GetExtendedPublicKeyUseCase,
      )
      .execute(derivationPath, { checkOnDevice });
  }
}
