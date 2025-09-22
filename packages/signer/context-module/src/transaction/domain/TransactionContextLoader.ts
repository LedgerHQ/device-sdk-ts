import { DeviceModelId, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import type {
  ProxyDataSource,
  ProxyImplementationAddress,
} from "@/proxy/data/ProxyDataSource";
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

    // try to fetch the transaction descriptors from the transaction data source
    // using the smart contract address to
    const transactionContexts =
      await this.transactionDataSource.getTransactionDescriptors({
        deviceModelId,
        address: to,
        chainId,
        selector,
      });

    if (
      transactionContexts.isRight() &&
      transactionContexts.extract().length > 0
    ) {
      return transactionContexts.extract();
    }

    // if the transaction descriptors are not found, try to fetch the proxy delegate call
    // and return the proxy delegate call context
    const proxyImplementationAddress =
      await this.proxyDataSource.getProxyImplementationAddress({
        calldata: data,
        proxyAddress: to,
        chainId,
        challenge: "",
      });

    return proxyImplementationAddress.caseOf<Promise<ClearSignContext[]>>({
      Right: async ({ implementationAddress }: ProxyImplementationAddress) => {
        if (!implementationAddress) {
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
            address: implementationAddress,
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
              type: ClearSignContextType.PROXY_INFO,
              payload: "0x",
            },
            ...transactionProxyContexts.extract(),
          ];
        }

        return [
          {
            type: ClearSignContextType.ERROR,
            error: new Error(
              `[ContextModule] TransactionContextLoader: Unable to fetch contexts from contract address using proxy delegate call ${implementationAddress}`,
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
