import { ethers } from "ethers";
import { Interface } from "ethers/lib/utils";
import { inject } from "inversify";

import type { ExternalPluginDataSource } from "@/external-plugin/data/ExternalPluginDataSource";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import { ClearSignContext } from "@/shared/model/ClearSignContext";
import { HexString, isHexString } from "@/shared/model/HexString";
import { TransactionContext } from "@/shared/model/TransactionContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";

export class ExternalPluginContextLoader implements ContextLoader {
  private _externalPluginDataSource: ExternalPluginDataSource;
  private _tokenDataSource: TokenDataSource;

  constructor(
    @inject("ExternalPluginDataSource")
    externalPluginDataSource: ExternalPluginDataSource,
    @inject("TokenDataSource") tokenDataSource: TokenDataSource,
  ) {
    this._externalPluginDataSource = externalPluginDataSource;
    this._tokenDataSource = tokenDataSource;
  }

  async load(transaction: TransactionContext) {
    if (!transaction.to || !transaction.data || transaction.data === "0x") {
      return [];
    }

    const selector = transaction.data.slice(0, 10);

    if (!isHexString(selector)) {
      return [{ type: "error" as const, error: new Error("Invalid selector") }];
    }

    const dappInfos = await this._externalPluginDataSource.getDappInfos({
      address: transaction.to,
      chainId: transaction.chainId,
      selector,
    });

    return await dappInfos.caseOf({
      Left: (error): Promise<ClearSignContext[]> =>
        Promise.resolve([{ type: "error" as const, error }]),
      Right: async (value): Promise<ClearSignContext[]> => {
        const response: ClearSignContext[] = [];

        if (!value) {
          return response;
        }

        const decodedCallData = this.getDecodedCallData(
          value.abi,
          value.selectorDetails.method,
          transaction.data ?? "", // FIXME: transaction.data is never undefined
        );

        for (const erc20Path of value.selectorDetails.erc20OfInterest) {
          const address = this.getAddressFromPath(erc20Path, decodedCallData);

          const tokenPayload = await this._tokenDataSource.getTokenInfosPayload(
            {
              address,
              chainId: transaction.chainId,
            },
          );

          tokenPayload.mapLeft((error) => {
            response.push({
              type: "error",
              error,
            });
          });

          tokenPayload.map((payload) => {
            response.push({
              type: "token",
              payload,
            });
          });
        }

        response.push({
          type: "externalPlugin",
          payload: value.selectorDetails.serializedData.concat(
            value.selectorDetails.signature,
          ),
        });

        return response;
      },
    });
  }

  private getDecodedCallData(abi: object[], method: string, data: string) {
    try {
      const contractInterface = new Interface(abi);
      return contractInterface.decodeFunctionData(method, data);
    } catch (e) {
      throw new Error(
        "[ContextModule] ExternalPluginContextLoader: Unable to parse abi",
      );
    }
  }

  private getAddressFromPath(
    path: string,
    decodedCallData: ethers.utils.Result,
  ): HexString {
    // ethers.utils.Result is a record string, any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = decodedCallData;
    for (const key of path.split(".")) {
      // In Solidity, a struct cannot begin with a number
      // Additionally, when we use -1, it signifies the last element of the array.
      if (key === "-1") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        value = value[value.length - 1];
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        value = value[key];
      }
    }

    if (!isHexString(value)) {
      throw new Error(
        "[ContextModule] ExternalPluginContextLoader: Unable to get address",
      );
    }

    return value;
  }
}
