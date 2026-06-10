import {
  type DeviceModelId,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Codec, number, string } from "purify-ts";

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
import { deviceModelIdCodec } from "@/shared/utils/deviceModelIdCodec";
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

const SOLANA_SIGNATURE_LENGTH = 64;
const SOLANA_MAX_SIGNATURES = 64;
const VERSIONED_MESSAGE_PREFIX_MASK = 0x80;
const SHORTVEC_CONTINUATION_BIT = 0x80;
const SHORTVEC_DATA_MASK = 0x7f;
const SHORTVEC_DATA_BITS = 7;

const solanaTransactionCheckInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
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
      rawTx = this.bs58Encoder.encode(
        this.wrapMessageAsTransaction(transactionBytes),
      );
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

  /**
   * Wrap a serialized Solana Message into a serialized Transaction expected
   * by the web3checks endpoint, by prepending a compact-u16 signature count
   * and the matching number of zero-filled signature placeholders.
   *
   * Supports legacy and versioned messages: versioned messages start with a
   * version prefix byte (high bit set), shifting `numRequiredSignatures` by
   * one position.
   */
  private wrapMessageAsTransaction(message: Uint8Array): Uint8Array {
    const numRequiredSignatures = this.readNumRequiredSignatures(message);
    const sigCount = this.encodeShortVec(numRequiredSignatures);
    const placeholdersLength = numRequiredSignatures * SOLANA_SIGNATURE_LENGTH;

    const wrapped = new Uint8Array(
      sigCount.length + placeholdersLength + message.length,
    );
    wrapped.set(sigCount, 0);
    wrapped.set(message, sigCount.length + placeholdersLength);
    return wrapped;
  }

  private readNumRequiredSignatures(message: Uint8Array): number {
    const firstByte = message[0];
    if (firstByte === undefined) {
      throw new Error(
        "[ContextModule] SolanaTransactionCheckLoader: empty transaction bytes",
      );
    }
    const isVersioned = (firstByte & VERSIONED_MESSAGE_PREFIX_MASK) !== 0;
    const headerOffset = isVersioned ? 1 : 0;
    const numRequiredSignatures = message[headerOffset];
    if (numRequiredSignatures === undefined) {
      throw new Error(
        "[ContextModule] SolanaTransactionCheckLoader: malformed message header",
      );
    }
    if (numRequiredSignatures > SOLANA_MAX_SIGNATURES) {
      throw new Error(
        `[ContextModule] SolanaTransactionCheckLoader: numRequiredSignatures (${numRequiredSignatures}) exceeds SOLANA_MAX_SIGNATURES (${SOLANA_MAX_SIGNATURES})`,
      );
    }
    return numRequiredSignatures;
  }

  private encodeShortVec(value: number): Uint8Array {
    const bytes: number[] = [];
    let remaining = value;
    while (true) {
      const lowBits = remaining & SHORTVEC_DATA_MASK;
      remaining >>>= SHORTVEC_DATA_BITS;
      if (remaining === 0) {
        bytes.push(lowBits);
        break;
      }
      bytes.push(lowBits | SHORTVEC_CONTINUATION_BIT);
    }
    return Uint8Array.from(bytes);
  }
}
