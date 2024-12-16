import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionType";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type SignerBtc } from "@api/SignerBtc";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { type GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";

import { type SignMessageUseCase } from "./use-cases/sign-message/SignMessageUseCase";
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

  signMessage(
    _derivationPath: string,
    _message: string,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(useCasesTypes.SignMessageUseCase)
      .execute(_derivationPath, _message);
  }
}
