import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { GetPubKeyCommand } from "@internal/app-binder/command/GetPubKeyCommand";
import {
  SignOffChainMessageCommand,
  type SignOffChainRawResponse,
} from "@internal/app-binder/command/SignOffChainMessageCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";

import {
  type CommandFactory,
  SendCommandInChunksTask,
} from "./SendCommandInChunksTask";

const DEVICE_V0_PAYLOAD_CEILING = 15 * 1024; // 15360
const DEVICE_LEGACY_PAYLOAD_CEILING = 1280;

// bytes reserved by app/header and transport
const RESERVED_HEADER_BYTES = 40;
const RESERVED_TRANSPORT_BYTES = 8;

// derived usable body sizes
const OFFCHAINMSG_MAX_LEN =
  DEVICE_V0_PAYLOAD_CEILING - RESERVED_HEADER_BYTES - RESERVED_TRANSPORT_BYTES; // 15312

const LEGACY_OFFCHAINMSG_MAX_LEN =
  DEVICE_LEGACY_PAYLOAD_CEILING -
  RESERVED_HEADER_BYTES -
  RESERVED_TRANSPORT_BYTES; // 1232

// device cap for v0 long UTF-8
const OFFCHAINMSG_MAX_V0_LEN = 65515;

const MAX_PRINTABLE_ASCII = 0x7e;
const MIN_PRINTABLE_ASCII = 0x20;
const LINE_FEED_ASCII = 0x0a;

export enum MessageFormat {
  Ascii = 0,
  Utf8 = 1,
  Utf8LongV0 = 2,
}

export const MAX_MESSAGE_LENGTH = OFFCHAINMSG_MAX_V0_LEN;

export type SendSignMessageTaskArgs = {
  sendingData: Uint8Array;
  derivationPath: string;
  appDomain?: string;
};

export type SendSignMessageTaskRunFunctionReturn = Promise<
  CommandResult<{ signature: string }, SolanaAppErrorCodes>
>;

export class SendSignMessageTask {
  constructor(
    private api: InternalApi,
    private args: SendSignMessageTaskArgs,
    private readonly bs58Encoder: Bs58Encoder = DefaultBs58Encoder,
  ) {}

  async run(): SendSignMessageTaskRunFunctionReturn {
    const { sendingData, derivationPath } = this.args;

    if (sendingData.length === 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Message cannot be empty"),
      });
    }
    if (sendingData.length > MAX_MESSAGE_LENGTH) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Message too long: ${sendingData.length} bytes (max is ${MAX_MESSAGE_LENGTH})`,
        ),
      });
    }

    const paths = DerivationPathUtils.splitPath(derivationPath);

    const pubkeyResult = await this.api.sendCommand(
      new GetPubKeyCommand({ derivationPath, checkOnDevice: false }),
    );
    if (!("data" in pubkeyResult)) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Error getting public key from device",
        ),
      });
    }
    const signerPubkey = this.bs58Encoder.decode(pubkeyResult.data);

    // try v0 first
    const v0OCM = this._buildFullMessage(sendingData, signerPubkey, false);
    const v0Payload = this._buildApduCommand(v0OCM, paths);
    const v0Res = await this._sendInChunks(v0Payload);

    if (isSuccessCommandResult(v0Res)) {
      try {
        const sigB58 = this._buildEnvelopeBase58(v0Res.data, v0OCM);
        return CommandResultFactory({ data: { signature: sigB58 } });
      } catch (e) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            e instanceof Error ? e.message : String(e),
          ),
        });
      }
    }

    // if the app says header invalid, try legacy
    const v0Error: unknown =
      "error" in v0Res ? (v0Res as { error: unknown }).error : undefined;

    if (this._isInvalidOffchainHeaderError(v0Error)) {
      if (sendingData.length > LEGACY_OFFCHAINMSG_MAX_LEN) {
        return v0Res;
      }

      const legacyOCM = this._buildFullMessage(sendingData, signerPubkey, true);
      const legacyPayload = this._buildApduCommand(legacyOCM, paths);
      const legacyRes = await this._sendInChunks(legacyPayload);

      if (isSuccessCommandResult(legacyRes)) {
        try {
          const sigB58 = this._buildEnvelopeBase58(legacyRes.data, legacyOCM);
          return CommandResultFactory({ data: { signature: sigB58 } });
        } catch (e) {
          return CommandResultFactory({
            error: new InvalidStatusWordError(
              e instanceof Error ? e.message : String(e),
            ),
          });
        }
      }
      return legacyRes;
    }

    return v0Res;
  }

  private _isUTF8(buf: Uint8Array): boolean {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(buf);
      return true;
    } catch {
      return false;
    }
  }

  private _findMessageFormat(
    message: Uint8Array,
    isLegacy: boolean,
  ): MessageFormat {
    const maxLedgerLen = isLegacy
      ? LEGACY_OFFCHAINMSG_MAX_LEN
      : OFFCHAINMSG_MAX_LEN;

    if (message.length <= maxLedgerLen) {
      if (this._isPrintableASCII(message, isLegacy)) return MessageFormat.Ascii;
      if (this._isUTF8(message)) return MessageFormat.Utf8;
    } else if (message.length <= OFFCHAINMSG_MAX_V0_LEN) {
      if (this._isUTF8(message)) return MessageFormat.Utf8LongV0;
    } else {
      // unreachable if run() guards length
      throw new InvalidStatusWordError(
        `Message too long: ${message.length} bytes (max is ${OFFCHAINMSG_MAX_V0_LEN})`,
      );
    }
    // default to ASCII like legacy
    return MessageFormat.Ascii;
  }

  private _isPrintableASCII(buf: Uint8Array, isLegacy: boolean): boolean {
    for (let i = 0; i < buf.length; i++) {
      const ch: number = buf[i]!;
      if (!isLegacy && ch === LINE_FEED_ASCII) continue; // newline allowed only for non-legacy
      if (ch < MIN_PRINTABLE_ASCII || ch > MAX_PRINTABLE_ASCII) return false;
    }
    return true;
  }

  /**
   * build serialised off-chain message header + body
   * when `isLegacy` is true, build the short legacy header (no app-domain or signers).
   */
  private _buildFullMessage(
    messageBody: Uint8Array,
    signerPubkey: Uint8Array,
    isLegacy: boolean,
  ): Uint8Array {
    const format: MessageFormat = this._findMessageFormat(
      messageBody,
      isLegacy,
    );

    const builder = new ByteArrayBuilder();

    // signing domain: 0xFF + "solana offchain" (16 bytes)
    builder.add8BitUIntToData(0xff).addAsciiStringToData("solana offchain");

    // header version = 0
    builder.add8BitUIntToData(0);

    if (!isLegacy) {
      // application domain: encode provided domain, padded/truncated to 32 bytes
      const domainBytes = new Uint8Array(32);
      if (this.args.appDomain) {
        const encoded = new TextEncoder().encode(this.args.appDomain);
        domainBytes.set(encoded.subarray(0, 32));
      }
      builder.addBufferToData(domainBytes);
    }

    // message format
    builder.add8BitUIntToData(format);

    if (!isLegacy) {
      // signer count = 1
      builder.add8BitUIntToData(1);
      // signer pubkey (32 bytes)
      builder.addBufferToData(signerPubkey);
    }

    // message length (LE, 2 bytes)
    builder.add8BitUIntToData(messageBody.length & 0xff);
    builder.add8BitUIntToData((messageBody.length >> 8) & 0xff);

    // message body
    builder.addBufferToData(messageBody);

    return builder.build();
  }

  // guard for the device’s 0x6A81 “Invalid off-chain message header” error
  private _isInvalidOffchainHeaderError(
    e: unknown,
  ): e is { _tag: string; errorCode: string } {
    if (!e || typeof e !== "object") return false;
    const obj = e as Record<string, unknown>;
    const tag = obj["_tag"];
    const code = obj["errorCode"];
    return (
      typeof tag === "string" &&
      typeof code === "string" &&
      code.toLowerCase() === "6a81"
    );
  }

  /**
   * build APDU payload:
   * [signerCount=1][derivationsCount][each 4-byte index][OCM message]
   */
  private _buildApduCommand(
    fullMessage: Uint8Array,
    paths: number[],
  ): Uint8Array {
    const builder = new ByteArrayBuilder(
      1 + 1 + paths.length * 4 + fullMessage.length,
    );

    builder.add8BitUIntToData(1); // number of signers
    builder.add8BitUIntToData(paths.length); // number of derivations
    paths.forEach((idx) => builder.add32BitUIntToData(idx)); // big-endian
    builder.addBufferToData(fullMessage);

    return builder.build(); // larger than 255 is ok, SendCommandInChunksTask will chunk it
  }

  // send APDU payload using chunk task, return raw 64-byte signature (last chunk)
  private async _sendInChunks(
    apduPayload: Uint8Array,
  ): Promise<CommandResult<SignOffChainRawResponse, SolanaAppErrorCodes>> {
    const commandFactory: CommandFactory<SignOffChainRawResponse> = (
      chunkArgs,
    ) => new SignOffChainMessageCommand(chunkArgs);

    return await new SendCommandInChunksTask<SignOffChainRawResponse>(
      this.api,
      {
        data: apduPayload,
        commandFactory,
      },
    ).run();
  }

  // build base58 OCM envelope: [signatureCount=1][signature(64)][serialized OCM]
  private _buildEnvelopeBase58(
    rawSignature: Uint8Array,
    serializedOCM: Uint8Array,
  ): string {
    if (rawSignature.length !== 64) {
      throw new InvalidStatusWordError(
        `Invalid signature length: ${rawSignature.length} (expected 64)`,
      );
    }
    const sigCount = Uint8Array.of(1);
    const envelope = new Uint8Array(
      sigCount.length + rawSignature.length + serializedOCM.length,
    );
    envelope.set(sigCount, 0);
    envelope.set(rawSignature, sigCount.length);
    envelope.set(serializedOCM, sigCount.length + rawSignature.length);
    return this.bs58Encoder.encode(envelope);
  }
}
