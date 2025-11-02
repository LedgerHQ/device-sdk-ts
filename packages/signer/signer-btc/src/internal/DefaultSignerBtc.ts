import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type Psbt } from "@api/model/Psbt";
import { type PsbtOptions } from "@api/model/PsbtOptions";
import { type Wallet, type WalletPolicy } from "@api/model/Wallet";
import { type WalletAddressOptions } from "@api/model/WalletAddressOptions";
import { type SignerBtc } from "@api/SignerBtc";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { type GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";
import { type SignPsbtUseCase } from "@internal/use-cases/sign-psbt/SignPsbtUseCase";
import { type SignTransactionUseCase } from "@internal/use-cases/sign-transaction/SignTransactionUseCase";

import { type GetWalletAddressUseCase } from "./use-cases/get-wallet-address/GetWalletAddressUseCase";
import { type RegisterWalletPolicyUseCase } from "./use-cases/register-wallet-policy/RegisterWalletPolicyUseCase";
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

  getWalletAddress(
    wallet: Wallet,
    addressIndex: number,
    options?: WalletAddressOptions,
  ) {
    return this._container
      .get<GetWalletAddressUseCase>(useCasesTypes.GetWalletAddressUseCase)
      .execute(
        options?.checkOnDevice ?? false,
        wallet,
        options?.change ?? false,
        addressIndex,
        options?.skipOpenApp ?? false,
      );
  }

  signPsbt(wallet: Wallet, psbt: Psbt, options?: PsbtOptions) {
    return this._container
      .get<SignPsbtUseCase>(useCasesTypes.SignPsbtUseCase)
      .execute(wallet, psbt, options?.skipOpenApp ?? false);
  }

  getExtendedPublicKey(derivationPath: string, options?: AddressOptions) {
    return this._container
      .get<GetExtendedPublicKeyUseCase>(
        useCasesTypes.GetExtendedPublicKeyUseCase,
      )
      .execute(derivationPath, {
        checkOnDevice: options?.checkOnDevice ?? false,
        skipOpenApp: options?.skipOpenApp ?? false,
      });
  }

  signMessage(
    derivationPath: string,
    message: string,
    options?: MessageOptions,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(useCasesTypes.SignMessageUseCase)
      .execute(derivationPath, message, options?.skipOpenApp ?? false);
  }

  signTransaction(wallet: Wallet, psbt: Psbt, options?: PsbtOptions) {
    return this._container
      .get<SignTransactionUseCase>(useCasesTypes.SignTransactionUseCase)
      .execute(wallet, psbt, options?.skipOpenApp ?? false);
  }

  registerWalletPolicy(
    walletPolicy: WalletPolicy,
    options?: WalletAddressOptions,
  ) {
    return this._container
      .get<RegisterWalletPolicyUseCase>(useCasesTypes.RegisterWalletPolicyTask)
      .execute(walletPolicy, options?.skipOpenApp ?? false);
  }
}
