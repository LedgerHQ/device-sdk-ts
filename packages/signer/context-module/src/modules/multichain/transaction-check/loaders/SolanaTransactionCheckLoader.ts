import {
  DeviceModelId,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Codec, exactly, number, oneOf, string } from "purify-ts";

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
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@/shared/utils/bs58Encoder";
import { uint8ArrayCodec } from "@/shared/utils/uint8ArrayCodec";

export type SolanaTransactionCheckRequest = {
  from: string;
  transactionBytes: Uint8Array;
  chain: number;
};

export type SolanaTransactionCheckContextInput = {
  deviceModelId: DeviceModelId;
  transactionCheck: SolanaTransactionCheckRequest;
};

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_TRANSACTION_CHECK,
];

const solanaTransactionCheckInputCodec = Codec.interface({
  deviceModelId: oneOf([
    exactly(DeviceModelId.NANO_X),
    exactly(DeviceModelId.NANO_SP),
    exactly(DeviceModelId.STAX),
    exactly(DeviceModelId.FLEX),
  ]),
  transactionCheck: Codec.interface({
    from: string,
    transactionBytes: uint8ArrayCodec,
    chain: number,
  }),
});

@injectable()
export class SolanaTransactionCheckLoader
  implements TransactionCheckLoader<SolanaTransactionCheckContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(transactionCheckTypes.TransactionCheckDataSource)
    private readonly transactionCheckDataSource: TransactionCheckDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    private readonly certificateLoader: PkiCertificateLoader,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
    private readonly bs58Encoder: Bs58Encoder = DefaultBs58Encoder,
  ) {
    this.logger = loggerFactory("SolanaTransactionCheckLoader");
  }

  canHandle(
    input: unknown,
    expectedType: ClearSignContextType[],
  ): input is SolanaTransactionCheckContextInput {
    if (!SUPPORTED_TYPES.every((type) => expectedType.includes(type)))
      return false;
    return solanaTransactionCheckInputCodec.decode(input).caseOf({
      Left: () => false,
      Right: ({ transactionCheck: { from, transactionBytes } }) =>
        from.length > 0 && transactionBytes.length > 0,
    });
  }

  async load(
    ctx: SolanaTransactionCheckContextInput,
  ): Promise<ClearSignContext[]> {
    const { from, transactionBytes, chain } = ctx.transactionCheck;

    let rawTx: string;
    try {
      rawTx = this.bs58Encoder.encode(transactionBytes);
    } catch (error) {
      const result: ClearSignContext[] = [
        {
          type: ClearSignContextType.ERROR,
          error: error instanceof Error ? error : new Error(String(error)),
        },
      ];
      this.logger.debug("load result", { data: { result } });
      return result;
    }

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
