import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type Web3CheckContext,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  DmkError,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Transaction } from "@api/model/Transaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { GetConfigCommand } from "@internal/app-binder/command/GetConfigCommand";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

export type GetWeb3CheckTaskResult =
  | {
      readonly web3Check: ClearSignContextSuccess | null;
    }
  | {
      readonly web3Check: null;
      error: DmkError;
    };

export type GetWeb3CheckTaskArgs = {
  readonly contextModule: ContextModule;
  readonly mapper: TransactionMapperService;
  readonly transaction: Transaction;
  readonly options: TransactionOptions;
  readonly derivationPath: string;
};

export class GetWeb3CheckTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: GetWeb3CheckTaskArgs,
  ) {}

  async run(): Promise<GetWeb3CheckTaskResult> {
    const { contextModule, mapper, transaction } = this.args;
    const parsed = mapper.mapTransactionToSubset(transaction);
    parsed.ifLeft((err) => {
      throw err;
    });
    const { subset, serializedTransaction } = parsed.unsafeCoerce();

    const configResult = await this.api.sendCommand(new GetConfigCommand());
    //check error
    if (!isSuccessCommandResult(configResult)) {
      return {
        web3Check: null,
        error: configResult.error,
      };
    }

    //Only do Web3 Check if it is activated
    if (configResult.data.web3ChecksEnabled) {
      const getAddressCmd = new GetAddressCommand({
        derivationPath: this.args.derivationPath,
        checkOnDevice: false,
        returnChainCode: false,
      });
      const getAddressResult = await this.api.sendCommand(getAddressCmd);
      if (!isSuccessCommandResult(getAddressResult)) {
        return {
          web3Check: null,
          error: getAddressResult.error,
        };
      }

      const address = getAddressResult.data.address;
      const web3Params: Web3CheckContext = {
        from: address,
        rawTx: bufferToHexaString(serializedTransaction),
        chainId: subset.chainId,
      };
      const web3CheckContext: ClearSignContext | null =
        await contextModule.getWeb3Checks(web3Params);

      if (
        web3CheckContext === null ||
        web3CheckContext?.type === ClearSignContextType.ERROR
      ) {
        return {
          web3Check: null,
        };
      } else {
        return {
          web3Check: web3CheckContext,
        };
      }
    } else {
      return {
        web3Check: null,
      };
    }
  }
}
