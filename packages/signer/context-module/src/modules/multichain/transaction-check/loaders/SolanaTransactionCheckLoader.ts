import {
  DeviceModelId,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type TransactionCheckDataSource } from "@/modules/multichain/transaction-check/data/TransactionCheckDataSource";
import { transactionCheckTypes } from "@/modules/multichain/transaction-check/di/transactionCheckTypes";
import { type TransactionCheckLoader } from "@/modules/multichain/transaction-check/loaders/TransactionCheckLoader";
import { TransactionCheckPaths } from "@/modules/multichain/transaction-check/utils/constants";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type SolanaTransactionCheckRequest = {
  from: string;
  rawTx: string;
  chain: number;
};

export type SolanaTransactionCheckContextInput = {
  deviceModelId: DeviceModelId;
  transactionCheck: SolanaTransactionCheckRequest;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_TRANSACTION_CHECK,
];

@injectable()
export class SolanaTransactionCheckLoader
  implements TransactionCheckLoader<SolanaTransactionCheckContextInput>
{
  private logger: LoggerPublisherService;

  constructor(
    @inject(transactionCheckTypes.TransactionCheckDataSource)
    private transactionCheckDataSource: TransactionCheckDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaTransactionCheckLoader");
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is SolanaTransactionCheckContextInput {
    if (!SUPPORTED_TYPES.every((type) => expectedType.includes(type)))
      return false;
    if (typeof input !== "object" || input === null) return false;
    if (
      !("deviceModelId" in input) ||
      input.deviceModelId === undefined ||
      input.deviceModelId === DeviceModelId.NANO_S
    )
      return false;
    if (!("transactionCheck" in input)) return false;
    const tc = input.transactionCheck;
    return (
      typeof tc === "object" &&
      tc !== null &&
      "from" in tc &&
      typeof tc.from === "string" &&
      tc.from.length > 0 &&
      "rawTx" in tc &&
      typeof tc.rawTx === "string" &&
      tc.rawTx.length > 0 &&
      "chain" in tc &&
      typeof tc.chain === "number"
    );
  }

  async load(
    ctx: SolanaTransactionCheckContextInput,
  ): Promise<ClearSignContext[]> {
    const { from, rawTx, chain } = ctx.transactionCheck;

    const txCheck = await this.transactionCheckDataSource.check({
      path: TransactionCheckPaths.SOLANA_TRANSACTION,
      body: { tx: { from, raw: rawTx }, chain },
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
          type: ClearSignContextType.SOLANA_TRANSACTION_CHECK,
          payload: { descriptor: data.descriptor },
          certificate,
        };
      },
    });

    const result = [context];
    this.logger.debug("load result", { data: { result } });
    return result;
  }
}
