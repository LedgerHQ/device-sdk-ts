import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type TransactionSubset,
  type Web3CheckContext,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  type DmkError,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type TypedData } from "@api/model/TypedData";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";

export type GetWeb3CheckTaskResult =
  | {
      readonly web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null;
    }
  | {
      readonly web3Check: null;
      error: DmkError;
    };

export type GetWeb3CheckTypedDataTaskArgs = {
  readonly contextModule: ContextModule;
  readonly derivationPath: string;
  readonly data: TypedData;
};
export type GetWeb3CheckRawTxTaskArgs = {
  readonly contextModule: ContextModule;
  readonly derivationPath: string;
  readonly subset: TransactionSubset;
  readonly transaction: Uint8Array;
};
export type GetWeb3CheckTaskArgs =
  | GetWeb3CheckTypedDataTaskArgs
  | GetWeb3CheckRawTxTaskArgs;

export class GetWeb3CheckTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: GetWeb3CheckTaskArgs,
  ) {}

  async run(): Promise<GetWeb3CheckTaskResult> {
    // Get sender address
    const getAddressResult = await this.api.sendCommand(
      new GetAddressCommand({
        derivationPath: this.args.derivationPath,
        checkOnDevice: false,
        returnChainCode: false,
      }),
    );
    if (!isSuccessCommandResult(getAddressResult)) {
      return {
        web3Check: null,
        error: getAddressResult.error,
      };
    }

    const address = getAddressResult.data.address;
    const { deviceModelId } = this.api.getDeviceSessionState();
    const { contextModule } = this.args;
    let web3CheckContext: ClearSignContext | null;

    if (this.isRawTx(this.args)) {
      // Transaction simulation
      const { subset, transaction } = this.args;
      const web3Params: Web3CheckContext = {
        deviceModelId,
        from: address,
        rawTx: bufferToHexaString(transaction),
        chainId: subset.chainId,
      };
      web3CheckContext = await contextModule.getWeb3Checks(web3Params);
    } else {
      // Typed data simulation
      const web3Params: Web3CheckContext = {
        deviceModelId,
        from: address,
        data: this.args.data,
      };
      web3CheckContext = await contextModule.getWeb3Checks(web3Params);
    }

    if (
      web3CheckContext === null ||
      web3CheckContext?.type !== ClearSignContextType.WEB3_CHECK
    ) {
      return {
        web3Check: null,
      };
    }

    return {
      web3Check: web3CheckContext,
    };
  }

  private isRawTx(
    args: GetWeb3CheckTaskArgs,
  ): args is GetWeb3CheckRawTxTaskArgs {
    return "transaction" in args;
  }
}
