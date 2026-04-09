import { LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { ContextFieldLoader } from "@/shared/domain/ContextFieldLoader";
import {
  SolanaContextTypes,
  type SolanaTransactionCheckContextResult,
} from "@/shared/model/SolanaContextTypes";
import { WEB3_CHECKS_EXCLUDED_DEVICE_MODELS } from "@/shared/model/Web3ChecksTypes";
import { type SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import { type TransactionCheckDataSource } from "@/transaction-check/data/TransactionCheckDataSource";
import { transactionCheckTypes } from "@/transaction-check/di/transactionCheckTypes";

@injectable()
export class SolanaTransactionCheckContextLoader
  implements
    ContextFieldLoader<
      SolanaTransactionContext,
      SolanaContextTypes,
      SolanaTransactionCheckContextResult
    >
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(transactionCheckTypes.TransactionCheckDataSource)
    private readonly transactionCheckDataSource: TransactionCheckDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaTransactionCheckContextLoader");
  }

  public canHandle(
    field: unknown,
    expectedType: SolanaContextTypes,
  ): field is SolanaTransactionContext {
    if (expectedType !== SolanaContextTypes.TRANSACTION_CHECK) {
      return false;
    }

    if (typeof field !== "object" || field === null) {
      return false;
    }

    const ctx = field as SolanaTransactionContext;

    if (
      ctx.deviceModelId === undefined ||
      WEB3_CHECKS_EXCLUDED_DEVICE_MODELS.has(ctx.deviceModelId)
    ) {
      return false;
    }

    const tc = ctx.transactionCheck;
    if (tc === undefined) {
      return false;
    }

    const fromOk = typeof tc.from === "string" && tc.from.trim().length > 0;
    const rawOk = typeof tc.rawTx === "string" && tc.rawTx.trim().length > 0;

    return fromOk && rawOk;
  }

  public async loadField(
    solanaContext: SolanaTransactionContext,
  ): Promise<SolanaTransactionCheckContextResult> {
    this.logger.debug("[loadField] Loading Solana transaction check context", {
      data: { input: solanaContext },
    });

    const tc = solanaContext.transactionCheck;
    if (!tc) {
      return {
        type: SolanaContextTypes.ERROR,
        error: new Error(
          "[ContextModule] SolanaTransactionCheckContextLoader: transactionCheck is missing",
        ),
      };
    }

    const { deviceModelId } = solanaContext;

    const txCheck = await this.transactionCheckDataSource.getTransactionCheck({
      kind: "solana",
      from: tc.from.trim(),
      rawTx: tc.rawTx.trim(),
      chain: tc.chain,
      domain: tc.domain,
      block: tc.block,
    });

    return await txCheck.caseOf<Promise<SolanaTransactionCheckContextResult>>({
      Left: (error) =>
        Promise.resolve({
          type: SolanaContextTypes.ERROR,
          error,
        }),
      Right: async (data) => {
        const certificate = await this.certificateLoader.loadCertificate({
          keyId: data.publicKeyId,
          keyUsage: KeyUsage.TxSimulationSigner,
          targetDevice: deviceModelId,
        });

        return {
          type: SolanaContextTypes.TRANSACTION_CHECK,
          payload: {
            descriptor: data.descriptor,
          },
          certificate,
        };
      },
    });
  }
}
