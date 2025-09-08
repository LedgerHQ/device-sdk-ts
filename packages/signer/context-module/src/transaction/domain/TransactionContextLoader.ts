import { DeviceModelId, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import type { PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { PkiCertificate } from "@/pki/model/PkiCertificate";
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
    @inject(pkiTypes.PkiCertificateLoader)
    private certificateLoader: PkiCertificateLoader,
  ) {}

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    if (ctx.deviceModelId === DeviceModelId.NANO_S) {
      return [];
    }

    const { to, data, selector, chainId, deviceModelId, challenge } = ctx;
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

    const proxyDelegateCall = await this.proxyDataSource.getProxyDelegateCall({
      calldata: data,
      proxyAddress: to,
      chainId,
      challenge: challenge || "",
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

    let certificate: PkiCertificate | undefined = undefined;
    if (proxyDelegateCallDescriptor) {
      certificate = await this.certificateLoader.loadCertificate({
        keyId: KeyId.CalCalldataKey,
        keyUsage: KeyUsage.Calldata,
        targetDevice: ctx.deviceModelId,
      });
    }

    const proxyDelegateCallContext: ClearSignContext[] =
      proxyDelegateCallDescriptor
        ? [
            {
              type: ClearSignContextType.PROXY_DELEGATE_CALL,
              payload: proxyDelegateCallDescriptor,
              certificate: certificate,
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
