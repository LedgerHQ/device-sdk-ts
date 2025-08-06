import { HexaString, isHexaString } from "@ledgerhq/device-management-kit";
import { ethers, Interface } from "ethers";
import { inject, injectable } from "inversify";
import { Either, EitherAsync, Left, Right } from "purify-ts";

import type { ExternalPluginDataSource } from "@/external-plugin/data/ExternalPluginDataSource";
import { externalPluginTypes } from "@/external-plugin/di/externalPluginTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
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

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    const { to, data, selector, chainId } = ctx;
    if (to === undefined || data === "0x") {
      return [];
    }

    if (!isHexaString(selector)) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Invalid selector"),
        },
      ];
    }

    const eitherDappInfos = await this._externalPluginDataSource.getDappInfos({
      address: to,
      chainId,
      selector,
    });

    return EitherAsync<Error, ClearSignContext[]>(async ({ liftEither }) => {
      const dappInfos = await liftEither(eitherDappInfos);

      // if the dappInfos is null, return an empty array
      // this means that the selector is not a known selector
      if (!dappInfos) {
        return [];
      }

      const externalPluginContext: ClearSignContext = {
        type: ClearSignContextType.EXTERNAL_PLUGIN,
        payload: dappInfos.selectorDetails.serializedData.concat(
          dappInfos.selectorDetails.signature,
        ),
      };

      const decodedCallData = this.getDecodedCallData(
        dappInfos.abi,
        dappInfos.selectorDetails.method,
        data,
      );

      // if the call data cannot be decoded, return the error
      // but also the externalPluginContext because it is still valid
      if (decodedCallData.isLeft()) {
        return [
          {
            type: ClearSignContextType.ERROR,
            error: decodedCallData.extract(),
          },
          externalPluginContext,
        ];
      }

      // decodedCallData is a Right so we can extract it safely
      const extractedDecodedCallData =
        decodedCallData.extract() as ethers.Result;

      // get the token payload for each erc20OfInterest
      // and return the payload or the error
      const promises = dappInfos.selectorDetails.erc20OfInterest.map(
        async (erc20Path) =>
          this.getTokenPayload(ctx, erc20Path, extractedDecodedCallData),
      );

      const tokensPayload = await Promise.all(promises);

      // map the payload or the error to a ClearSignContext
      const contexts: ClearSignContext[] = tokensPayload.map((eitherToken) =>
        eitherToken.caseOf<ClearSignContext>({
          Left: (error) => ({ type: ClearSignContextType.ERROR, error }),
          Right: (payload) => ({ type: ClearSignContextType.TOKEN, payload }),
        }),
      );

      return [...contexts, externalPluginContext];
    }).caseOf<ClearSignContext[]>({
      // parse all errors into ClearSignContext
      Left: (error) => [{ type: ClearSignContextType.ERROR, error }],
      Right: (contexts) => contexts,
    });
  }

  private getTokenPayload(
    ctx: TransactionContext,
    erc20Path: string,
    decodedCallData: ethers.Result,
  ) {
    const address = this.getAddressFromPath(erc20Path, decodedCallData);

    return EitherAsync<Error, string>(({ fromPromise }) =>
      fromPromise(
        this._tokenDataSource.getTokenInfosPayload({
          address,
          chainId: ctx.chainId,
        }),
      ),
    );
  }

  private getDecodedCallData(
    abi: object[],
    method: string,
    data: string,
  ): Either<Error, ethers.Result> {
    try {
      const contractInterface = new Interface(abi);
      return Right(contractInterface.decodeFunctionData(method, data));
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] ExternalPluginContextLoader: Unable to parse abi",
        ),
      );
    }
  }

  private getAddressFromPath(
    path: string,
    decodedCallData: ethers.Result,
  ): HexaString {
    // ethers.Result is a record string, any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = decodedCallData;
    for (const key of path.split(".")) {
      // In Solidity, a struct cannot begin with a number
      // Additionally, when we use -1, it signifies the last element of the array.
      if (key === "-1") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        value = value[value.length - 1];
      } else {
        // This access can throw a RangeError error in case of an invalid key
        // but is correctly caught by the liftEither above
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        value = value[key];
      }
    }

    if (!isHexaString(value)) {
      throw new Error(
        "[ContextModule] ExternalPluginContextLoader: Unable to get address",
      );
    }

    return value;
  }
}
