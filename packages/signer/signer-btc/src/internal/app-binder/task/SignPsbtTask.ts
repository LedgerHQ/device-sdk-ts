import {
  ByteArrayParser,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Either, Left, Maybe, Right } from "purify-ts";

import {
  type MusigPartialSignature,
  type MusigPubNonce,
  type PartialSignature,
  type PsbtSignature,
} from "@api/model/Signature";
import { SignPsbtCommand } from "@internal/app-binder/command/SignPsbtCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { type BuildPsbtTaskResult } from "@internal/app-binder/task/BuildPsbtTask";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { type DataStore } from "@internal/data-store/model/DataStore";
import { PsbtGlobal } from "@internal/psbt/model/Psbt";
import type { ValueParser } from "@internal/psbt/service/value/ValueParser";
import { extractVarint } from "@internal/utils/Varint";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type SignPsbtTaskArgs = BuildPsbtTaskResult & {
  wallet: InternalWallet;
};

export type SignPsbtTaskResult = CommandResult<PsbtSignature[], BtcErrorCodes>;

const MUSIG_PUBNONCE_TAG = 0xffffffff;
const MUSIG_PARTIAL_SIGNATURE_TAG = 0xfffffffe;
const PARTIAL_SIGNATURE_MAX_TAG = 0xffff;
const PUBKEY_LENGTH = 32;
const PUBKEY_LENGTH_COMPRESSED = 33;
const PUBKEY_LENGTH_TAPLEAF = 64;
const PARTIAL_SIGNATURE_LENGTH = 32;
const PUBNONCE_LENGTH = 66;

export class SignPsbtTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SignPsbtTaskArgs,
    private readonly _walletSerializer: WalletSerializer,
    private readonly _valueParser: ValueParser,
    private readonly _continueTaskFactory = (
      api: InternalApi,
      dataStore: DataStore,
    ) => new ContinueTask(api, dataStore),
  ) {}

  /**
   * Executes the task of signing a PSBT (Partially Signed Bitcoin Transaction) by processing
   * the necessary PSBT components, sending the signing command, and handling the responses.
   *
   * The method first extracts the required data from the PSBT and wallet arguments, sends a signing
   * PSBT command using these details, and continues the task execution using the resulting command output.
   *
   * If the command results in success, it decodes the returned signatures, performing error handling for failures
   * in decoding. Finally, it returns the successfully decoded signatures or an error response.
   *
   * @return {Promise<SignPsbtTaskResult>} A promise that resolves with the result of the PSBT signing process.
   * This can either be a success object containing decoded PSBT signatures or an error result.
   */
  async run(): Promise<SignPsbtTaskResult> {
    const {
      psbtCommitment: { globalCommitment, inputsRoot, outputsRoot },
      psbt,
      wallet,
      dataStore,
    } = this._args;
    const signPsbtCommandResult = await this._api.sendCommand(
      new SignPsbtCommand({
        globalCommitment,
        inputsRoot,
        outputsRoot,
        inputsCount: psbt
          .getGlobalValue(PsbtGlobal.INPUT_COUNT)
          .chain((value) => this._valueParser.getVarint(value.data))
          .orDefault(0),
        outputsCount: psbt
          .getGlobalValue(PsbtGlobal.OUTPUT_COUNT)
          .chain((value) => this._valueParser.getVarint(value.data))
          .orDefault(0),
        walletId: this._walletSerializer.getId(wallet),
        walletHmac: wallet.hmac,
      }),
    );

    const continueTask = this._continueTaskFactory(this._api, dataStore);
    const result = await continueTask.run(signPsbtCommandResult);

    if (isSuccessCommandResult(result)) {
      const encodedSignatures = continueTask.getYieldedResults();
      const decodedSignatures: PsbtSignature[] = [];
      // decode yielded signatures
      for (const encodedSignature of encodedSignatures) {
        const decodedSignature = this._decodePsbtSignature(encodedSignature);
        if (decodedSignature.isLeft()) {
          return CommandResultFactory({
            error: decodedSignature.extract(),
          });
        } else if (decodedSignature.isRight()) {
          decodedSignatures.push(decodedSignature.extract());
        }
      }
      return CommandResultFactory({ data: decodedSignatures });
    }
    return result;
  }

  /**
   * Decodes a PSBT (Partially Signed Bitcoin Transaction) signature from a given byte array input.
   * It determines the type of signature or data present based on input tags and delegates processing
   * to the appropriate decoding method.
   *
   * If inputOrTag is:
   *  - at most 0xffff then it's a partial signature (legacy, native segwit, taproot or nested segwit) https://github.com/LedgerHQ/app-bitcoin-new/blob/24bcdae8274fa9866a11db54a713d93d5467c819/doc/bitcoin.md#if-tag_or_input_index-is-at-most-65535
   *  - equal to 0xFFFFFFFF then it's a round 1 of musig2 protocol https://github.com/LedgerHQ/app-bitcoin-new/blob/24bcdae8274fa9866a11db54a713d93d5467c819/doc/bitcoin.md#if-tag_or_input_index-is-more-than-65535
   *  - equal to 0xFFFFFFFE then it's a round 2 of musig2 protocol https://github.com/LedgerHQ/app-bitcoin-new/blob/24bcdae8274fa9866a11db54a713d93d5467c819/doc/bitcoin.md#if-tag_or_input_index-is-more-than-65535
   *
   * @param {Uint8Array} yieldedSignature - The byte array representing the PSBT signature to decode.
   * @return {Either<InvalidStatusWordError, PsbtSignature>} - Either the decoded PSBT signature or an error if decoding fails.
   */
  private _decodePsbtSignature(
    yieldedSignature: Uint8Array,
  ): Either<InvalidStatusWordError, PsbtSignature> {
    const parser = new ByteArrayParser(yieldedSignature);
    const inputIndexOrTagOrError = extractVarint(parser)
      .map((val) => val.value)
      .toEither(new InvalidStatusWordError("Invalid input index or tag"));
    if (inputIndexOrTagOrError.isLeft()) {
      return inputIndexOrTagOrError;
    }
    const inputIndexOrTag = inputIndexOrTagOrError.unsafeCoerce();

    if (inputIndexOrTag === MUSIG_PUBNONCE_TAG) {
      return this._decodeMusigPubNonce(parser);
    } else if (inputIndexOrTag === MUSIG_PARTIAL_SIGNATURE_TAG) {
      return this._decodeMusigPartialSignature(parser);
    } else if (inputIndexOrTag <= PARTIAL_SIGNATURE_MAX_TAG) {
      return this._decodePartialSignature(parser, inputIndexOrTag);
    }
    return Left(
      new InvalidStatusWordError(
        `Invalid input index or tag returned: ${inputIndexOrTag}`,
      ),
    );
  }

  /**
   * Decodes a Musig public nonce from the provided byte stream parser.
   *
   * @param {ByteArrayParser} parser - The parser used to extract data fields from a byte array.
   * @return {Either<InvalidStatusWordError, MusigPubNonce>} An `Either` containing either:
   * - `MusigPubNonce` object if decoding is successful, or
   * - `InvalidStatusWordError` if any required field is missing or invalid.
   */
  private _decodeMusigPubNonce(
    parser: ByteArrayParser,
  ): Either<InvalidStatusWordError, MusigPubNonce> {
    const inputIndexOrError = extractVarint(parser)
      .map((val) => val.value)
      .toEither(new InvalidStatusWordError("Invalid input index"));
    const pubnonceOrError = Maybe.fromNullable(
      parser.extractFieldByLength(PUBNONCE_LENGTH),
    ).toEither(new InvalidStatusWordError("Pubnonce is missing"));
    const participantPubkeyOrError = Maybe.fromNullable(
      parser.extractFieldByLength(PUBKEY_LENGTH_COMPRESSED),
    ).toEither(new InvalidStatusWordError("Participant pubkey is missing"));
    const aggregatedPubkeyOrError = Maybe.fromNullable(
      parser.extractFieldByLength(PUBKEY_LENGTH_COMPRESSED),
    ).toEither(new InvalidStatusWordError("Aggregated pubkey is missing"));
    const tapleafHash = Maybe.fromNullable(
      parser.extractFieldByLength(parser.getUnparsedRemainingLength()),
    ).orDefault(Uint8Array.from([]));
    return inputIndexOrError.chain((inputIndex) =>
      Either.sequence([
        pubnonceOrError,
        participantPubkeyOrError,
        aggregatedPubkeyOrError,
      ]).map((values) => ({
        inputIndex,
        pubnonce: values[0]!,
        participantPubkey: values[1]!,
        aggregatedPubkey: values[2]!,
        tapleafHash,
      })),
    );
  }

  /**
   * Decodes a Musig partial signature from the given byte array parser.
   * This involves extracting and validating the input index, partial signature,
   * participant public key, aggregated public key, and the optional tapleaf hash.
   *
   * @param {ByteArrayParser} parser The parser to extract the Musig partial signature data from.
   * @return {Either<InvalidStatusWordError, MusigPartialSignature>}
   *         Returns an `Either` containing the decoded Musig partial signature on success or
   *         an `InvalidStatusWordError` if any required component is missing or invalid.
   */
  private _decodeMusigPartialSignature(
    parser: ByteArrayParser,
  ): Either<InvalidStatusWordError, MusigPartialSignature> {
    const inputIndexOrError = extractVarint(parser)
      .map((val) => val.value)
      .toEither(new InvalidStatusWordError("Invalid input index"));
    const partialSignatureOrError = Maybe.fromNullable(
      parser.extractFieldByLength(PARTIAL_SIGNATURE_LENGTH),
    ).toEither(new InvalidStatusWordError("Partial signature is missing"));
    const participantPubkeyOrError = Maybe.fromNullable(
      parser.extractFieldByLength(PUBKEY_LENGTH_COMPRESSED),
    ).toEither(new InvalidStatusWordError("Participant pubkey is missing"));
    const aggregatedPubkeyOrError = Maybe.fromNullable(
      parser.extractFieldByLength(PUBKEY_LENGTH_COMPRESSED),
    ).toEither(new InvalidStatusWordError("Aggregated pubkey is missing"));
    const tapleafHash = Maybe.fromNullable(
      parser.extractFieldByLength(parser.getUnparsedRemainingLength()),
    ).orDefault(Uint8Array.from([]));
    return inputIndexOrError.chain((inputIndex) => {
      return Either.sequence([
        partialSignatureOrError,
        participantPubkeyOrError,
        aggregatedPubkeyOrError,
      ]).map((values) => ({
        inputIndex,
        partialSignature: values[0]!,
        participantPubkey: values[1]!,
        aggregatedPubkey: values[2]!,
        tapleafHash,
      }));
    });
  }

  /**
   * Decodes a partial signature from the provided parser, extracting the public key and signature data
   * and validating their lengths based on the transaction type.
   *
   * @param {ByteArrayParser} parser - The parser instance used to extract data fields.
   * @param {number} inputIndex - The index of the transaction input associated with the signature.
   * @return {Either<InvalidStatusWordError, PartialSignature>} Either an error if the decoding fails or the decoded partial signature object containing the input index, signature, public key, and optionally the tapleaf hash.
   */
  private _decodePartialSignature(
    parser: ByteArrayParser,
    inputIndex: number,
  ): Either<InvalidStatusWordError, PartialSignature> {
    const pubkeyOrError = Maybe.fromNullable(parser.extract8BitUInt())
      .toEither(new InvalidStatusWordError("Pubkey length is missing"))
      .chain((pubKeyAugmentedLength) => {
        return Maybe.fromNullable(
          parser.extractFieldByLength(pubKeyAugmentedLength),
        ).toEither(new InvalidStatusWordError("Pubkey is missing"));
      });
    const signatureOrError = Maybe.fromNullable(
      parser.extractFieldByLength(parser.getUnparsedRemainingLength()),
    ).toEither(new InvalidStatusWordError("Signature is missing"));
    return Either.sequence([pubkeyOrError, signatureOrError]).chain(
      (values) => {
        const pubkey = values[0]!;
        const signature = values[1]!;
        if (pubkey.length === PUBKEY_LENGTH_TAPLEAF) {
          // tapscript spend: pubkey_augm is the concatenation of:
          // - a 32-byte x-only pubkey
          // - the 32-byte tapleaf_hash
          return Right({
            inputIndex,
            signature,
            pubkey: pubkey.slice(0, PUBKEY_LENGTH),
            tapleafHash: pubkey.slice(PUBKEY_LENGTH),
          });
        } else if (
          [PUBKEY_LENGTH, PUBKEY_LENGTH_COMPRESSED].includes(pubkey.length)
        ) {
          // either legacy, segwit or taproot keypath spend
          // pubkey must be 32 (taproot x-only pubkey) or 33 bytes (compressed pubkey)
          return Right({
            inputIndex,
            signature,
            pubkey,
          });
        }
        return Left(
          new InvalidStatusWordError(
            `Invalid pubkey length returned: ${pubkey.length}`,
          ),
        );
      },
    );
  }
}
