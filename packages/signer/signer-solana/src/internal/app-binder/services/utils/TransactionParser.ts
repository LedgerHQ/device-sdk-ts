import { base64StringToBuffer } from "@ledgerhq/device-management-kit";
import {
  type Message,
  type MessageV0,
  PublicKey,
  Transaction,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { type Either, EitherAsync, Left, Right } from "purify-ts";

import {
  type AddressLookupRef,
  type NormalisedCompiledIx,
  type NormalizedMessage,
} from "@internal/app-binder/services/TransactionInspector";

import { type AddressLookupTableResolver } from "./AddressLookupTableResolver";
import {
  AccountIndexOutOfRangeError,
  EmptyInstructionsError,
  InvalidVersionError,
  MalformedTransactionError,
  MAX_ACCOUNTS_PER_INSTRUCTION,
  MIN_MESSAGE_BYTES,
  OversizedAccountArrayError,
  type ParserError,
  TruncatedTransactionError,
} from "./ParserError";

const VERSION_PREFIX_MASK = 0x7f;
// Pads `allKeys` at unresolved ALT slots. The all-zero key is base58 the
// System Program ID, so consumers must use `addressLookupRefs` to tell an
// unresolved ALT slot from a real account.
const PLACEHOLDER_KEY = new PublicKey(new Uint8Array(32));

export type ParsedTransaction = {
  message: NormalizedMessage;
  usesAddressLookupTables: boolean;
};

export type TransactionParserOptions = {
  /**
   * When `true` and no `AddressLookupTableResolver` is provided, ALT
   * references are kept on the output (placeholder pubkeys in `allKeys`, raw
   * refs in `addressLookupRefs`) instead of being dropped. Defaults to
   * `false`, preserving the existing drop-ALT behaviour.
   */
  preserveAltRefs?: boolean;
};

/**
 * Decodes raw transaction bytes into a normalised message (legacy + v0). ALT
 * references are resolved when an {@link AddressLookupTableResolver} is
 * provided, or preserved on the output when `preserveAltRefs` is set and no
 * resolver is given. Malformed input is returned as a typed `ParserError`,
 * never thrown.
 */
export class TransactionParser {
  private readonly altResolver?: AddressLookupTableResolver;
  private readonly preserveAltRefs: boolean;

  constructor(
    altResolver?: AddressLookupTableResolver,
    options?: TransactionParserOptions,
  ) {
    this.altResolver = altResolver;
    this.preserveAltRefs = options?.preserveAltRefs ?? false;
  }

  parse(rawBytes: Uint8Array): EitherAsync<ParserError, ParsedTransaction> {
    return EitherAsync(async ({ liftEither, fromPromise }) => {
      if (rawBytes.length < MIN_MESSAGE_BYTES) {
        return liftEither(
          Left(
            new TruncatedTransactionError(
              `Need at least ${MIN_MESSAGE_BYTES} bytes, got ${rawBytes.length}.`,
            ),
          ),
        );
      }

      const decoded = decodeMessage(rawBytes);
      const message = await liftEither(decoded);

      const isV0 = message.version !== "legacy";
      const usesAddressLookupTables =
        isV0 && (message as MessageV0).addressTableLookups.length > 0;

      const normalised = isV0
        ? await fromPromise(this.normaliseV0(message as MessageV0).run())
        : await liftEither(this.normaliseLegacy(message as Message));

      return { message: normalised, usesAddressLookupTables };
    });
  }

  /**
   * Check whether the raw bytes represent a versioned transaction that uses
   * address lookup tables (ALTs). Read-only probe used by the inspector;
   * unlike {@link parse} this returns a plain boolean.
   */
  hasAddressLookupTables(rawBytes: Uint8Array): boolean {
    if (rawBytes.length < MIN_MESSAGE_BYTES) return false;
    const decoded = decodeMessage(rawBytes);
    return decoded
      .map(
        (msg) =>
          msg.version !== "legacy" &&
          (msg as MessageV0).addressTableLookups.length > 0,
      )
      .orDefault(false);
  }

  private normaliseLegacy(
    message: Message,
  ): Either<ParserError, NormalizedMessage> {
    const allKeys = [...message.accountKeys];
    const logicalKeyCount = allKeys.length;
    const writableMap = buildWritableMap(message, logicalKeyCount);

    return buildCompiledInstructions(
      message.compiledInstructions,
      writableMap,
      logicalKeyCount,
    ).map((compiledInstructions) => ({
      compiledInstructions,
      allKeys,
    }));
  }

  private normaliseV0(
    message: MessageV0,
  ): EitherAsync<ParserError, NormalizedMessage> {
    return EitherAsync(async ({ liftEither }) => {
      const staticKeys = [...message.staticAccountKeys];
      const altCount = message.numAccountKeysFromLookups;
      const logicalKeyCount = staticKeys.length + altCount;
      const writableMap = buildWritableMap(message, logicalKeyCount);

      let allKeys: PublicKey[];
      let addressLookupRefs: (AddressLookupRef | undefined)[] | undefined;

      if (this.altResolver && altCount > 0) {
        const lookedUp = await this.altResolver.resolve(message);
        allKeys = [
          ...staticKeys,
          ...(lookedUp?.writable ?? []),
          ...(lookedUp?.readonly ?? []),
        ];
      } else if (this.preserveAltRefs && altCount > 0) {
        const altRefs = buildAltRefs(message);
        allKeys = [
          ...staticKeys,
          ...Array.from({ length: altRefs.length }, () => PLACEHOLDER_KEY),
        ];
        addressLookupRefs = [
          ...Array.from({ length: staticKeys.length }, () => undefined),
          ...altRefs,
        ];
      } else {
        allKeys = staticKeys;
      }

      const compiled = await liftEither(
        buildCompiledInstructions(
          message.compiledInstructions,
          writableMap,
          logicalKeyCount,
        ),
      );

      const normalised: NormalizedMessage = {
        compiledInstructions: compiled,
        allKeys,
      };
      if (addressLookupRefs) {
        normalised.addressLookupRefs = addressLookupRefs;
      }
      return normalised;
    });
  }
}

/**
 * Inspects the version prefix and dispatches to the appropriate web3.js
 * decoder. Returns a typed `ParserError` on any decoding failure.
 */
function decodeMessage(
  rawBytes: Uint8Array,
): Either<ParserError, Message | MessageV0> {
  const versionedTx = tryDeserialiseVersioned(rawBytes);
  if (versionedTx.isRight()) {
    return Right(versionedTx.extract() as Message | MessageV0);
  }

  const legacyTx = tryDeserialiseLegacy(rawBytes);
  if (legacyTx.isRight()) {
    return Right(legacyTx.extract() as Message);
  }

  // Both decoders failed. Deserialising first avoids misreading a legacy
  // transaction's leading shortvec byte as a version prefix; only now, if the
  // first byte carries a non-zero versioned prefix, report an unsupported
  // version — otherwise the bytes are malformed.
  const firstByte = rawBytes[0]!;
  if ((firstByte & 0x80) !== 0 && (firstByte & VERSION_PREFIX_MASK) !== 0) {
    return Left(new InvalidVersionError(firstByte & VERSION_PREFIX_MASK));
  }
  return Left(versionedTx.extract() as ParserError);
}

function tryDeserialiseVersioned(
  rawBytes: Uint8Array,
): Either<ParserError, Message | MessageV0> {
  try {
    const tx = VersionedTransaction.deserialize(rawBytes);
    return Right(tx.message as Message | MessageV0);
  } catch (signedErr) {
    try {
      return Right(VersionedMessage.deserialize(rawBytes));
    } catch (msgErr) {
      return Left(
        new MalformedTransactionError(
          "Failed to decode versioned Solana message.",
          msgErr ?? signedErr,
        ),
      );
    }
  }
}

function tryDeserialiseLegacy(
  rawBytes: Uint8Array,
): Either<ParserError, Message> {
  try {
    return Right(Transaction.from(rawBytes).compileMessage());
  } catch (err) {
    return Left(
      new MalformedTransactionError(
        "Failed to decode legacy Solana transaction.",
        err,
      ),
    );
  }
}

function buildWritableMap(
  message: Message | MessageV0,
  logicalKeyCount: number,
): boolean[] {
  const writable: boolean[] = [];
  for (let i = 0; i < logicalKeyCount; i++) {
    writable.push(message.isAccountWritable(i));
  }
  return writable;
}

function buildAltRefs(message: MessageV0): AddressLookupRef[] {
  const writableRefs: AddressLookupRef[] = [];
  const readonlyRefs: AddressLookupRef[] = [];
  for (const lookup of message.addressTableLookups) {
    for (const entryIndex of lookup.writableIndexes) {
      writableRefs.push({ altAddress: lookup.accountKey, entryIndex });
    }
    for (const entryIndex of lookup.readonlyIndexes) {
      readonlyRefs.push({ altAddress: lookup.accountKey, entryIndex });
    }
  }
  return [...writableRefs, ...readonlyRefs];
}

/** @internal — exported for unit testing. */
export function buildCompiledInstructions(
  compiledInstructions: ReadonlyArray<{
    programIdIndex: number;
    accountKeyIndexes: number[];
    data: Uint8Array;
  }>,
  writableMap: boolean[],
  logicalKeyCount: number,
): Either<ParserError, NormalisedCompiledIx[]> {
  if (compiledInstructions.length === 0) {
    return Left(new EmptyInstructionsError());
  }

  const out: NormalisedCompiledIx[] = [];
  for (let ixIdx = 0; ixIdx < compiledInstructions.length; ixIdx++) {
    const ci = compiledInstructions[ixIdx]!;
    if (ci.accountKeyIndexes.length > MAX_ACCOUNTS_PER_INSTRUCTION) {
      return Left(
        new OversizedAccountArrayError(ixIdx, ci.accountKeyIndexes.length),
      );
    }
    if (ci.programIdIndex >= logicalKeyCount) {
      return Left(
        new AccountIndexOutOfRangeError(
          ixIdx,
          -1,
          ci.programIdIndex,
          logicalKeyCount,
        ),
      );
    }
    const accountWritable: boolean[] = [];
    for (let slot = 0; slot < ci.accountKeyIndexes.length; slot++) {
      const keyIdx = ci.accountKeyIndexes[slot]!;
      if (keyIdx >= logicalKeyCount) {
        return Left(
          new AccountIndexOutOfRangeError(ixIdx, slot, keyIdx, logicalKeyCount),
        );
      }
      accountWritable.push(writableMap[keyIdx] ?? false);
    }

    const data =
      ci.data instanceof Uint8Array
        ? ci.data
        : typeof ci.data === "string"
          ? (base64StringToBuffer(ci.data) ?? new Uint8Array())
          : Uint8Array.from(ci.data ?? []);

    out.push({
      programIdIndex: ci.programIdIndex,
      accountKeyIndexes: [...ci.accountKeyIndexes],
      accountWritable,
      data,
    });
  }
  return Right(out);
}
