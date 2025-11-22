import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import {
  type AddressOptions,
  type GetAddressDAReturnType,
  type SignTransactionDAReturnType,
  type TransactionOptions,
} from "@api/index";
import { type SignerCosmos } from "@api/SignerCosmos";
import { makeContainer } from "@internal/di";

import { type GetAddressUseCase } from "./use-cases/address/GetAddressUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";
import { type SignTransactionUseCase } from "./use-cases/transaction/SignTransactionUseCase";

type DefaultSignerCosmosConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};

export class DefaultSignerCosmos implements SignerCosmos {
  private _container: Container;

  constructor({
    dmk,
    sessionId,
    contextModule,
  }: DefaultSignerCosmosConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId, contextModule });
  }
  signTransaction(
    derivationPath: string,
    serializedSignDoc: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(useCasesTypes.SignTransactionUseCase)
      .execute(derivationPath, serializedSignDoc, options);
  }
  getAddress(
    derivationPath: string,
    prefix: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(useCasesTypes.GetAddressUseCase)
      .execute(derivationPath, prefix, options);
  }
}
