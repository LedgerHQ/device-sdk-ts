import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import {
  type PublicKeyOptions,
  type SignerConcordium,
  type TransactionOptions,
} from "@api/SignerConcordium";
import { makeContainer } from "@internal/di";
import { publicKeyTypes } from "@internal/use-cases/publickey/di/publicKeyTypes";
import { type GetPublicKeyUseCase } from "@internal/use-cases/publickey/GetPublicKeyUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

type DefaultSignerConcordiumConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerConcordium implements SignerConcordium {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerConcordiumConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getPublicKey(
    derivationPath: string,
    options?: PublicKeyOptions,
  ): GetPublicKeyDAReturnType {
    return this._container
      .get<GetPublicKeyUseCase>(publicKeyTypes.GetPublicKeyUseCase)
      .execute(derivationPath, options);
  }

  signTransaction(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, options);
  }
}
