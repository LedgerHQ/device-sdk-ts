import { ethers } from "ethers";
import { Interface } from "ethers/lib/utils";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { DappInfos } from "@/external-plugin//model/DappInfos";
import type { ExternalPluginDataSource } from "@/external-plugin/data/ExternalPluginDataSource";
import { externalPluginTypes } from "@/external-plugin/di/externalPluginTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import { ClearSignContext } from "@/shared/model/ClearSignContext";
import { HexString, isHexString } from "@/shared/model/HexString";
import { TransactionContext } from "@/shared/model/TransactionContext";
import type { TokenDataSource } from "@/token/data/TokenDataSource";
import { tokenTypes } from "@/token/di/tokenTypes";

@injectable()
export class ExternalPluginContextLoader implements ContextLoader {
  private _externalPluginDataSource: ExternalPluginDataSource;
  private _tokenDataSource: TokenDataSource;

  constructor(
    @inject(externalPluginTypes.ExternalPluginDataSource)
    externalPluginDataSource: ExternalPluginDataSource,
    @inject(tokenTypes.TokenDataSource) tokenDataSource: TokenDataSource,
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

    return this.processDappInfos(dappInfos, transaction);
  }

  /**
   * Process the DappInfos and return the ClearSignContext array with
   * the tokens and external plugin data
   *
   * if there is an error, return it as a ClearSignContext
   *
   * @param either
   * @param transaction
   * @returns Promise<ClearSignContext[]>
   */
  private processDappInfos(
    either: Either<Error, DappInfos | undefined>,
    transaction: TransactionContext,
  ): Promise<ClearSignContext[]> {
    return either.caseOf({
      Left: (error): Promise<ClearSignContext[]> =>
        Promise.resolve([{ type: "error" as const, error }]),
      Right: async (value): Promise<ClearSignContext[]> => {
        return await this.handleDappInfos(value, transaction);
      },
    });
  }

  /**
   * Handle the DappInfos and return the ClearSignContext array with
   * the tokens and external plugin data
   *
   * If dappInfos is undefined, return an empty array
   *
   * @param dappInfos
   * @param transaction
   * @returns Promise<ClearSignContext[]>
   */
  private async handleDappInfos(
    dappInfos: DappInfos | undefined,
    transaction: TransactionContext,
  ): Promise<ClearSignContext[]> {
    if (!dappInfos) {
      return [];
    }

    const eitherDecodedCallData = this.getDecodedCallData(
      dappInfos.abi,
      dappInfos.selectorDetails.method,
      transaction.data ?? "",
    );

    const tokensPayload = await this.processDecodedCallData(
      eitherDecodedCallData,
      dappInfos,
      transaction,
    );

    return [
      ...tokensPayload,
      {
        type: "externalPlugin" as const,
        payload: dappInfos.selectorDetails.serializedData.concat(
          dappInfos.selectorDetails.signature,
        ),
      },
    ];
  }

  /**
   * Process the decoded call data and return the ClearSignContext array with
   * the tokens and external plugin data
   *
   * If there is an error, return it as a ClearSignContext
   *
   * @param either
   * @param dappInfos
   * @param transaction
   * @returns Promise<ClearSignContext[]>
   */
  private processDecodedCallData(
    either: Either<Error, ethers.utils.Result>,
    dappInfos: DappInfos,
    transaction: TransactionContext,
  ): Promise<ClearSignContext[]> {
    return either.caseOf({
      Left: (error): Promise<ClearSignContext[]> => {
        return Promise.resolve([{ type: "error" as const, error }]);
      },
      Right: async (decodedCallData): Promise<ClearSignContext[]> => {
        return await this.handleDecodedCallData(
          decodedCallData,
          dappInfos,
          transaction,
        );
      },
    });
  }

  /**
   * Handle the decoded call data and return the ClearSignContext array with
   * the tokens and external plugin data
   *
   * @param decodedCallData
   * @param dappInfos
   * @param transaction
   * @returns Promise<ClearSignContext[]>
   */
  private async handleDecodedCallData(
    decodedCallData: ethers.utils.Result,
    dappInfos: DappInfos,
    transaction: TransactionContext,
  ): Promise<ClearSignContext[]> {
    const promises = dappInfos.selectorDetails.erc20OfInterest.map(
      async (erc20Path) =>
        this.getTokenPayload(transaction, erc20Path, decodedCallData),
    );

    const tokensPayload = await Promise.all(promises);

    return tokensPayload;
  }

  private async getTokenPayload(
    transaction: TransactionContext,
    erc20Path: string,
    decodedCallData: ethers.utils.Result,
  ): Promise<ClearSignContext> {
    const address = this.getAddressFromPath(erc20Path, decodedCallData);

    const tokenPayload = await this._tokenDataSource.getTokenInfosPayload({
      address,
      chainId: transaction.chainId,
    });

    return tokenPayload.caseOf({
      Left: (error): ClearSignContext => ({ type: "error" as const, error }),
      Right: (payload): ClearSignContext => ({
        type: "token" as const,
        payload,
      }),
    });
  }

  private getDecodedCallData(
    abi: object[],
    method: string,
    data: string,
  ): Either<Error, ethers.utils.Result> {
    try {
      const contractInterface = new Interface(abi);
      return Right(contractInterface.decodeFunctionData(method, data));
    } catch (e) {
      return Left(
        new Error(
          "[ContextModule] ExternalPluginContextLoader: Unable to parse abi",
        ),
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
