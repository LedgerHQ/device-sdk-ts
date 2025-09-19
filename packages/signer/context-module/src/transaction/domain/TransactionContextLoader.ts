import {
  DeviceModelId,
  HexaString,
  isHexaString,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { MaybeAsync } from "purify-ts";

import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";
import type { TransactionDataSource } from "@/transaction/data/TransactionDataSource";
import { transactionTypes } from "@/transaction/di/transactionTypes";

@injectable()
export class TransactionContextLoader implements ContextLoader {
  constructor(
    @inject(transactionTypes.TransactionDataSource)
    private transactionDataSource: TransactionDataSource,
    @inject(proxyTypes.ProxyDataSource)
    private proxyDataSource: ProxyDataSource,
  ) {}

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    if (ctx.deviceModelId === DeviceModelId.NANO_S) {
      return [];
    }

    const { to, data, selector, chainId, deviceModelId } = ctx;
    if (to === undefined) {
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

    return this._getTransactionContexts(to, chainId, selector, deviceModelId)
      .alt(
        this._getTransactionProxyContexts(
          to,
          chainId,
          selector,
          deviceModelId,
          data,
        ),
      )
      .orDefault([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] TransactionContextLoader: No transaction contexts found",
          ),
        },
      ]);
  }

  private _getTransactionContexts(
    address: string,
    chainId: number,
    selector: HexaString,
    deviceModelId: DeviceModelId,
  ): MaybeAsync<ClearSignContext[]> {
    return MaybeAsync(async ({ liftMaybe }) => {
      const result = await this.transactionDataSource.getTransactionDescriptors(
        {
          deviceModelId,
          address,
          chainId,
          selector,
        },
      );

      return liftMaybe(result.toMaybe().filter((ctxs) => ctxs.length > 0));
    });
  }

  private _getTransactionProxyContexts(
    address: string,
    chainId: number,
    selector: HexaString,
    deviceModelId: DeviceModelId,
    data: string,
  ): MaybeAsync<ClearSignContext[]> {
    const proxyAddress = MaybeAsync(async ({ liftMaybe }) => {
      const result = await this.proxyDataSource.getProxyImplementationAddress({
        calldata: data,
        proxyAddress: address,
        chainId,
        challenge: "",
      });
      return liftMaybe(result.toMaybe());
    });

    // return a MaybeAsync of the transaction contexts from the proxy address using _getTransactionContexts
    return proxyAddress
      .map<MaybeAsync<ClearSignContext[]>>(({ implementationAddress }) => {
        return this._getTransactionContexts(
          implementationAddress,
          chainId,
          selector,
          deviceModelId,
        ).map((contexts) => [
          // Add a proxy info context to the list of contexts
          // to specify that the proxy info should be refetched during the provide step
          {
            type: ClearSignContextType.PROXY_INFO,
            payload: "0x",
          },
          ...contexts,
        ]);
      })
      .join();
  }
}
