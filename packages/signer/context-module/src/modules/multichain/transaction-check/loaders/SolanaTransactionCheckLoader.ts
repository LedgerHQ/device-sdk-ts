import {
  type DeviceModelId,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Codec, number, optional, string } from "purify-ts";

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
  /**
   * Full wire-format serialized transaction (`tx.serialize()`). When provided,
   * co-signer signatures already present in this blob are forwarded in the
   * Transaction Check payload instead of being zero-filled. Never sent to the
   * device. Must serialize the same message as `transactionBytes`.
   */
  serializedTransactionForTransactionCheck?: Uint8Array;
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
const PLACEHOLDER_SIGNATURE_FILL = 0x01;
const SHORTVEC_MAX_SHIFT = 21;

const solanaTransactionCheckInputCodec = Codec.interface({
  deviceModelId: deviceModelIdCodec,
  transactionCheck: Codec.interface({
    from: string,
    transactionBytes: uint8ArrayCodec,
    chain: number,
    serializedTransactionForTransactionCheck: optional(uint8ArrayCodec),
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
    const {
      from,
      transactionBytes,
      chain,
      serializedTransactionForTransactionCheck,
    } = ctx.transactionCheck;

    let rawTx: string;
    try {
      rawTx = this.bs58Encoder.encode(
        this.wrapMessageAsTransaction(
          transactionBytes,
          serializedTransactionForTransactionCheck,
        ),
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
   * Wraps a serialized Solana message into a transaction for the web3checks
   * endpoint by prepending signature placeholders, and (when provided) forwards
   * valid co-signer signatures recovered from serializedTransactionForTransactionCheck.
   */
  private wrapMessageAsTransaction(
    message: Uint8Array,
    serializedTransactionForTransactionCheck?: Uint8Array,
  ): Uint8Array {
    const numRequiredSignatures = this.readNumRequiredSignatures(message);
    const sigCount = this.encodeShortVec(numRequiredSignatures);
    const placeholdersLength = numRequiredSignatures * SOLANA_SIGNATURE_LENGTH;

    const wrapped = new Uint8Array(
      sigCount.length + placeholdersLength + message.length,
    );
    wrapped.set(sigCount, 0);
    wrapped.set(message, sigCount.length + placeholdersLength);

    for (const [index, signature] of this.recoverSignatures(
      message,
      numRequiredSignatures,
      serializedTransactionForTransactionCheck,
    )) {
      wrapped.set(signature, sigCount.length + index * SOLANA_SIGNATURE_LENGTH);
    }

    return wrapped;
  }

  private recoverSignatures(
    message: Uint8Array,
    numRequiredSignatures: number,
    serialized: Uint8Array | undefined,
  ): Map<number, Uint8Array> {
    const none = new Map<number, Uint8Array>();
    if (!serialized || serialized.length === 0) return none;

    const header = this.decodeShortVec(serialized);
    if (header === null) return this.skipRecovery("unreadable signature count");
    const { value: count, byteLength } = header;

    if (count !== numRequiredSignatures)
      return this.skipRecovery("signature count does not match message header");

    const messageOffset = byteLength + count * SOLANA_SIGNATURE_LENGTH;
    if (serialized.length - messageOffset !== message.length)
      return this.skipRecovery("message region length mismatch");
    if (!this.bytesEqual(serialized.subarray(messageOffset), message))
      return this.skipRecovery("message region does not match transaction");

    const recovered = new Map<number, Uint8Array>();
    for (let i = 0; i < count; i++) {
      const start = byteLength + i * SOLANA_SIGNATURE_LENGTH;
      const signature = serialized.subarray(
        start,
        start + SOLANA_SIGNATURE_LENGTH,
      );
      if (!this.isPlaceholderSignature(signature)) recovered.set(i, signature);
    }
    return recovered;
  }

  private skipRecovery(reason: string): Map<number, Uint8Array> {
    this.logger.debug("[recoverSignatures] skipping recovery", {
      data: { reason },
    });
    return new Map();
  }

  private decodeShortVec(
    bytes: Uint8Array,
  ): { value: number; byteLength: number } | null {
    let value = 0;
    let shift = 0;
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]!;
      value |= (byte & SHORTVEC_DATA_MASK) << shift;
      if ((byte & SHORTVEC_CONTINUATION_BIT) === 0) {
        return { value, byteLength: i + 1 };
      }
      shift += SHORTVEC_DATA_BITS;
      if (shift > SHORTVEC_MAX_SHIFT) return null;
    }
    return null;
  }

  private isPlaceholderSignature(signature: Uint8Array): boolean {
    const first = signature[0];
    if (first !== 0x00 && first !== PLACEHOLDER_SIGNATURE_FILL) return false;
    return signature.every((byte) => byte === first);
  }

  private bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    return a.every((byte, i) => byte === b[i]);
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
