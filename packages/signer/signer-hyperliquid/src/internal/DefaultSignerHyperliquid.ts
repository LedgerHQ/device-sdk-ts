import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";
import { type SignerHyperliquid } from "@api/SignerHyperliquid";
import { makeContainer } from "@internal/di";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { messageTypes } from "@internal/use-cases/message/di/messageTypes";
import { type SignMessageUseCase } from "@internal/use-cases/message/SignMessageUseCase";

type DefaultSignerHyperliquidConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerHyperliquid implements SignerHyperliquid {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerHyperliquidConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
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

  signMessage(
    derivationPath: string,
    message: string | Uint8Array,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(messageTypes.SignMessageUseCase)
      .execute(derivationPath, message);
  }
}
