import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type Psbt } from "@api/model/Psbt";
import { type Wallet } from "@api/model/Wallet";
import { type WalletAddressOptions } from "@api/model/WalletAddressOptions";
import { type SignerBtc } from "@api/SignerBtc";
import { useCasesTypes } from "@internal/use-cases/di/useCasesTypes";
import { type GetExtendedPublicKeyUseCase } from "@internal/use-cases/get-extended-public-key/GetExtendedPublicKeyUseCase";
import { type SignPsbtUseCase } from "@internal/use-cases/sign-psbt/SignPsbtUseCase";
import { type SignTransactionUseCase } from "@internal/use-cases/sign-transaction/SignTransactionUseCase";

import { type GetWalletAddressUseCase } from "./use-cases/get-wallet-address/GetWalletAddressUseCase";
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
    { checkOnDevice = false, change = false }: WalletAddressOptions,
  ) {
    return this._container
      .get<GetWalletAddressUseCase>(useCasesTypes.GetWalletAddressUseCase)
      .execute(checkOnDevice, wallet, change, addressIndex);
  }

  signPsbt(wallet: Wallet, psbt: Psbt) {
    return this._container
      .get<SignPsbtUseCase>(useCasesTypes.SignPsbtUseCase)
      .execute(wallet, psbt);
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
    derivationPath: string,
    message: string,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(useCasesTypes.SignMessageUseCase)
      .execute(derivationPath, message);
  }

  signTransaction(wallet: Wallet, psbt: Psbt) {
    return this._container
      .get<SignTransactionUseCase>(useCasesTypes.SignTransactionUseCase)
      .execute(wallet, psbt);
  }
}
