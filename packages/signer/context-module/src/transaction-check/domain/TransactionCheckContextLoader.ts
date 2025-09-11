import { inject, injectable } from "inversify";

import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";
import { type TransactionCheckDataSource } from "@/transaction-check/data/TransactionCheckDataSource";
import { transactionCheckTypes } from "@/transaction-check/di/transactionCheckTypes";

@injectable()
export class TransactionCheckContextLoader implements ContextLoader {
  constructor(
    @inject(transactionCheckTypes.TransactionCheckDataSource)
    private transactionCheckDataSource: TransactionCheckDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private certificateLoader: PkiCertificateLoader,
  ) {}

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    const { from, chainId, rawTx } = ctx;

    if (!from || !rawTx) {
      return [];
    }

    const txCheck = await this.transactionCheckDataSource.getTransactionCheck({
      chainId,
      rawTx,
      from,
    });

    const context = await txCheck.caseOf<Promise<ClearSignContext>>({
      Left: (error) =>
        Promise.resolve({
          type: ClearSignContextType.ERROR,
          error,
        }),
      Right: async (data) => {
        const certificate = await this.certificateLoader.loadCertificate({
          keyId: data.publicKeyId,
          keyUsage: KeyUsage.TxSimulationSigner,
          targetDevice: ctx.deviceModelId,
        });

        return {
          type: ClearSignContextType.TRANSACTION_CHECK,
          payload: data.descriptor,
          certificate,
        };
      },
    });

    return [context];
  }
}
