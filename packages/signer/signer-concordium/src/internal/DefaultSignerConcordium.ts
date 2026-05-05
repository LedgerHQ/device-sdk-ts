import {
  type ConcordiumAccountOwnershipNetwork,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetPublicKeyDAReturnType } from "@api/app-binder/GetPublicKeyDeviceActionTypes";
import { type SignCredentialDeploymentTransactionDAReturnType } from "@api/app-binder/SignCredentialDeploymentTransactionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type VerifyAddressDAReturnType } from "@api/app-binder/VerifyAddressDeviceActionTypes";
import { type PublicKeyOptions } from "@api/model/PublicKeyOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type VerifyAddressOptions } from "@api/model/VerifyAddressOptions";
import { type SignerConcordium } from "@api/SignerConcordium";
import { makeContainer } from "@internal/di";
import { appConfigTypes } from "@internal/use-cases/app-config/di/appConfigTypes";
import { type GetAppConfigUseCase } from "@internal/use-cases/app-config/GetAppConfigUseCase";
import { credentialDeploymentTypes } from "@internal/use-cases/credential-deployment/di/credentialDeploymentTypes";
import { type SignCredentialDeploymentTransactionUseCase } from "@internal/use-cases/credential-deployment/SignCredentialDeploymentTransactionUseCase";
import { publicKeyTypes } from "@internal/use-cases/publickey/di/publicKeyTypes";
import { type GetPublicKeyUseCase } from "@internal/use-cases/publickey/GetPublicKeyUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";
import { verifyAddressTypes } from "@internal/use-cases/verify-address/di/verifyAddressTypes";
import { type VerifyAddressUseCase } from "@internal/use-cases/verify-address/VerifyAddressUseCase";

type DefaultSignerConcordiumConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};

export class DefaultSignerConcordium implements SignerConcordium {
  private readonly _container: Container;

  constructor({
    dmk,
    sessionId,
    contextModule,
  }: DefaultSignerConcordiumConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId, contextModule });
  }

  getAppConfiguration(): GetAppConfigDAReturnType {
    return this._container
      .get<GetAppConfigUseCase>(appConfigTypes.GetAppConfigUseCase)
      .execute();
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

  signCredentialDeploymentTransaction(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignCredentialDeploymentTransactionDAReturnType {
    return this._container
      .get<SignCredentialDeploymentTransactionUseCase>(
        credentialDeploymentTypes.SignCredentialDeploymentTransactionUseCase,
      )
      .execute(derivationPath, transaction, options);
  }

  verifyAddress(
    derivationPath: string,
    address: string,
    network: ConcordiumAccountOwnershipNetwork,
    options?: VerifyAddressOptions,
  ): VerifyAddressDAReturnType {
    return this._container
      .get<VerifyAddressUseCase>(verifyAddressTypes.VerifyAddressUseCase)
      .execute(derivationPath, address, network, options);
  }
}
