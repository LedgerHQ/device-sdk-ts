import { type SolanaTransactionSerializer } from "./SolanaTransactionSerializer";

const SOLANA_SIGNATURE_LENGTH = 64;
const SOLANA_MAX_SIGNATURES = 64;
const VERSIONED_MESSAGE_PREFIX_MASK = 0x80;
const SHORTVEC_CONTINUATION_BIT = 0x80;
const SHORTVEC_DATA_MASK = 0x7f;
const SHORTVEC_DATA_BITS = 7;
const PLACEHOLDER_SIGNATURE_FILL = 0x01;
const SHORTVEC_MAX_SHIFT = 21;

export class DefaultSolanaTransactionSerializer
  implements SolanaTransactionSerializer
{
  wrapMessageAsTransaction(
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
    if (header === null) return none;
    const { value: count, byteLength } = header;

    if (count !== numRequiredSignatures) return none;

    const messageOffset = byteLength + count * SOLANA_SIGNATURE_LENGTH;
    if (serialized.length - messageOffset !== message.length) return none;
    if (!this.bytesEqual(serialized.subarray(messageOffset), message))
      return none;

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
        "[signer-solana] SolanaTransactionSerializer: empty transaction bytes",
      );
    }
    const isVersioned = (firstByte & VERSIONED_MESSAGE_PREFIX_MASK) !== 0;
    const headerOffset = isVersioned ? 1 : 0;
    const numRequiredSignatures = message[headerOffset];
    if (numRequiredSignatures === undefined) {
      throw new Error(
        "[signer-solana] SolanaTransactionSerializer: malformed message header",
      );
    }
    if (numRequiredSignatures > SOLANA_MAX_SIGNATURES) {
      throw new Error(
        `[signer-solana] SolanaTransactionSerializer: numRequiredSignatures (${numRequiredSignatures}) exceeds SOLANA_MAX_SIGNATURES (${SOLANA_MAX_SIGNATURES})`,
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
