import { DeviceModelId, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { ProxyDelegateCall } from "@/proxy/model/ProxyDelegateCall";
import { SupportedChainIds } from "@/safe/constant/SupportedChainIds";
import { safeTypes } from "@/safe/di/safeTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";
import type { TransactionDataSource } from "@/transaction/data/TransactionDataSource";
import { transactionTypes } from "@/transaction/di/transactionTypes";

@injectable()
export class SafeTransactionContextLoader implements ContextLoader {
  constructor(
    @inject(transactionTypes.TransactionDataSource)
    private transactionDataSource: TransactionDataSource,
    @inject(safeTypes.SafeProxyDataSource)
    private proxyDataSource: ProxyDataSource,
  ) {}

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    const { to, data, selector, chainId, deviceModelId } = ctx;
    if (to === undefined) {
      return [];
    }

    if (deviceModelId === DeviceModelId.NANO_S) {
      return [];
    }

    if (!Object.values(SupportedChainIds).includes(chainId)) {
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

    const proxyDelegateCall = await this.proxyDataSource.getProxyDelegateCall({
      calldata: data,
      proxyAddress: to,
      chainId,
      challenge: "",
    });

    return proxyDelegateCall.caseOf<Promise<ClearSignContext[]>>({
      Right: async ({ delegateAddresses }: ProxyDelegateCall) => {
        const resolvedAddress = delegateAddresses[0];

        if (!resolvedAddress) {
          return [
            {
              type: ClearSignContextType.ERROR,
              error: new Error(
                `[ContextModule] TransactionContextLoader: No delegate address found for proxy ${to}`,
              ),
            },
          ];
        }

        const transactionProxyContexts =
          await this.transactionDataSource.getTransactionDescriptors({
            deviceModelId,
            address: resolvedAddress,
            chainId,
            selector,
          });

        if (
          transactionProxyContexts.isRight() &&
          transactionProxyContexts.extract().length > 0
        ) {
          return [
            // This payload is not used as the clear sign context is not used, only the subcontext that will be
            // fetched during the provide, with a correct challenge
            {
              type: ClearSignContextType.PROXY_DELEGATE_CALL,
              payload: "0x",
            },
            ...transactionProxyContexts.extract(),
          ];
        }

        return [
          {
            type: ClearSignContextType.ERROR,
            error: new Error(
              `[ContextModule] TransactionContextLoader: Unable to fetch contexts from contract address using proxy delegate call ${resolvedAddress}`,
            ),
          },
        ];
      },
      Left: (_) => {
        return Promise.resolve([
          {
            type: ClearSignContextType.ERROR,
            error: new Error(
              `[ContextModule] TransactionContextLoader: Unable to fetch contexts from contract address ${to}`,
            ),
          },
        ]);
      },
    });
  }
}
