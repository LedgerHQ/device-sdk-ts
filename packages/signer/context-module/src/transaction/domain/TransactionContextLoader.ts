import { DeviceModelId, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import type { ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { ProxyDelegateCall } from "@/proxy/model/ProxyDelegateCall";
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

    const proxyDelegateCall = await this.proxyDataSource.getProxyDelegateCall({
      calldata: data,
      proxyAddress: to,
      chainId,
      challenge: "",
    });

    // get the resolved address from the list of delegate addresses
    // if the transaction.to is not in the list of delegate addresses,
    //    return the first element as the resolved address,
    //    and undefined as the proxy delegate call descriptor
    // if the transaction.to is in the list of delegate addresses,
    //    return the transaction.to as the resolved address,
    //    and the proxy delegate call descriptor
    const [resolvedAddress, proxyDelegateCallDescriptor]: [
      string,
      string | undefined,
    ] = proxyDelegateCall.caseOf({
      Left: () => [to!, undefined],
      Right: (proxyData: ProxyDelegateCall): [string, string | undefined] => {
        return [
          proxyData.delegateAddresses.find((address) => address === to) ||
            proxyData.delegateAddresses[0]!,
          proxyData.signedDescriptor,
        ];
      },
    });

    const proxyDelegateCallContext: ClearSignContext[] =
      proxyDelegateCallDescriptor
        ? [
            {
              type: ClearSignContextType.PROXY_DELEGATE_CALL,
              // This payload is not used as the clear sign context is not used, only the subcontext that will be
              // fetched during the provide, with a correct challenge
              payload: "0x",
            },
          ]
        : [];

    const transactionContexts = (
      await this.transactionDataSource.getTransactionDescriptors({
        deviceModelId,
        address: resolvedAddress,
        chainId,
        selector,
      })
    ).caseOf({
      Left: (error): ClearSignContext[] => [
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ],
      Right: (contexts): ClearSignContext[] => contexts,
    });

    return [...proxyDelegateCallContext, ...transactionContexts];
  }
}
