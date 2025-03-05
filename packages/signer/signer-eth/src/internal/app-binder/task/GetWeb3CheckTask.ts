import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
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
import { GetAppConfiguration } from "@internal/app-binder/command/GetAppConfigurationCommand";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

export type GetWeb3CheckTaskResult =
  | {
      readonly web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null;
    }
  | {
      readonly web3Check: null;
      error: DmkError;
    };

export type GetWeb3CheckTaskArgs =
  | {
      readonly contextModule: ContextModule;
      readonly derivationPath: string;
      readonly mapper: TransactionMapperService;
      readonly transaction: Uint8Array;
    }
  | {
      readonly contextModule: ContextModule;
      readonly derivationPath: string;
      readonly data: TypedData;
    };

export class GetWeb3CheckTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: GetWeb3CheckTaskArgs,
  ) {}

  async run(): Promise<GetWeb3CheckTaskResult> {
    const configResult = await this.api.sendCommand(new GetAppConfiguration());
    // Check error
    if (!isSuccessCommandResult(configResult)) {
      return {
        web3Check: null,
        error: configResult.error,
      };
    }

    // Only do Web3 Check if it is activated
    if (!configResult.data.web3ChecksEnabled) {
      return {
        web3Check: null,
      };
    }

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

    if ("transaction" in this.args) {
      // Transaction simulation
      const parsed = this.args.mapper.mapTransactionToSubset(
        this.args.transaction,
      );
      parsed.ifLeft((err) => {
        throw err;
      });
      const { subset, serializedTransaction } = parsed.unsafeCoerce();
      const web3Params: Web3CheckContext = {
        deviceModelId,
        from: address,
        rawTx: bufferToHexaString(serializedTransaction),
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
}
