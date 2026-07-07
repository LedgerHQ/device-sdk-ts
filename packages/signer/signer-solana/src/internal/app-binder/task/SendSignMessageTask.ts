import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidArgumentError,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
  type CommandFactory,
  DerivationPathUtils,
  SendCommandInChunksTask,
} from "@ledgerhq/signer-utils";

import { SignMessageVersion } from "@api/model/MessageOptions";
import { GetPubKeyCommand } from "@internal/app-binder/command/GetPubKeyCommand";
import {
  SignOffChainMessageCommand,
  type SignOffChainRawResponse,
} from "@internal/app-binder/command/SignOffChainMessageCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { SOLANA_PUBKEY_LEN } from "@internal/app-binder/constants";
import {
  type Bs58Encoder,
  DefaultBs58Encoder,
} from "@internal/app-binder/services/bs58Encoder";
import {
  LEGACY_OFFCHAINMSG_MAX_LEN,
  OffchainMessageBuilder,
  OFFCHAINMSG_MAX_LEN,
} from "@internal/app-binder/services/OffchainMessageBuilder";

export { MessageFormat } from "@internal/app-binder/services/OffchainMessageBuilder";

const V1_MAX_SIGNERS = 255;

// V0 and V1 share the device's single off-chain payload ceiling
// (app-solana MAX_OFFCHAIN_MESSAGE_LENGTH). Legacy targets older, smaller-buffer
// devices, so it keeps its own tighter limit.
const MESSAGE_SIZE_LIMITS: Partial<Record<SignMessageVersion, number>> = {
  [SignMessageVersion.V1]: OFFCHAINMSG_MAX_LEN,
  [SignMessageVersion.V0]: OFFCHAINMSG_MAX_LEN,
  [SignMessageVersion.Legacy]: LEGACY_OFFCHAINMSG_MAX_LEN,
};

export type SendSignMessageTaskArgs = {
  sendingData: string | Uint8Array;
  derivationPath: string;
  version?: SignMessageVersion;
  appDomain?: string;
  signers?: Uint8Array[];
};

export type SendSignMessageTaskRunFunctionReturn = Promise<
  CommandResult<{ signature: string }, SolanaAppErrorCodes>
>;

export class SendSignMessageTask {
  private readonly _builder: OffchainMessageBuilder;
  private readonly _logger?: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendSignMessageTaskArgs,
    private readonly bs58Encoder: Bs58Encoder = DefaultBs58Encoder,
  ) {
    this._builder = new OffchainMessageBuilder(args.appDomain);
    this._logger = api.loggerFactory?.("SendSignMessageTask");
  }

  async run(): SendSignMessageTaskRunFunctionReturn {
    const {
      sendingData: rawInput,
      derivationPath,
      version = SignMessageVersion.V0,
    } = this.args;

    if (version === SignMessageVersion.Raw && typeof rawInput === "string") {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Raw mode requires a Uint8Array payload, not a string",
        ),
      });
    }

    const sendingData =
      typeof rawInput === "string"
        ? new TextEncoder().encode(rawInput)
        : rawInput;

    if (sendingData.length === 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Message cannot be empty"),
      });
    }

    const maxLen = MESSAGE_SIZE_LIMITS[version];
    if (maxLen !== undefined && sendingData.length > maxLen) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Message too long: ${sendingData.length} bytes (max is ${maxLen})`,
        ),
      });
    }

    const paths = DerivationPathUtils.splitPath(derivationPath);

    switch (version) {
      case SignMessageVersion.Raw:
        return this._runRaw(sendingData, paths);
      case SignMessageVersion.V1:
        return this._runV1(sendingData, derivationPath, paths);
      case SignMessageVersion.V0:
        return this._runV0(sendingData, derivationPath, paths);
      case SignMessageVersion.Legacy:
        return this._runLegacy(sendingData, paths);
      default:
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Unsupported message version: ${String(version)}`,
          ),
        });
    }
  }

  private async _getSignerPubkey(
    derivationPath: string,
  ): Promise<Uint8Array | null> {
    const result = await this.api.sendCommand(
      new GetPubKeyCommand({ derivationPath, checkOnDevice: false }),
    );
    if (!("data" in result)) return null;
    return this.bs58Encoder.decode(result.data);
  }

  private async _runRaw(
    sendingData: Uint8Array,
    paths: number[],
  ): SendSignMessageTaskRunFunctionReturn {
    const payload = this._builder.buildApduPayload(sendingData, paths);
    const res = await this._sendInChunks(payload);

    if (isSuccessCommandResult(res)) {
      if (res.data.length !== 64) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Invalid signature length: ${res.data.length} (expected 64)`,
          ),
        });
      }
      return CommandResultFactory({
        data: { signature: this.bs58Encoder.encode(res.data) },
      });
    }
    return res;
  }

  /**
   * Build OCM, send to device, and wrap a successful response into
   * a base58 envelope. Returns `null` on 6a81 to signal the caller
   * should try the next fallback version.
   */
  private async _sendAndWrap(
    ocm: Uint8Array,
    paths: number[],
  ): Promise<SendSignMessageTaskRunFunctionReturn | null> {
    const payload = this._builder.buildApduPayload(ocm, paths);
    const res = await this._sendInChunks(payload);

    if (isSuccessCommandResult(res)) {
      try {
        const sigB58 = this._builder.buildEnvelopeBase58(
          res.data,
          ocm,
          this.bs58Encoder,
        );
        return CommandResultFactory({ data: { signature: sigB58 } });
      } catch (e) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            e instanceof Error ? e.message : String(e),
          ),
        });
      }
    }

    const error: unknown =
      "error" in res ? (res as { error: unknown }).error : undefined;

    if (this._isInvalidOffchainHeaderError(error)) {
      return null;
    }

    return res;
  }

  private async _runV1(
    sendingData: Uint8Array,
    derivationPath: string,
    paths: number[],
  ): SendSignMessageTaskRunFunctionReturn {
    const extraSigners = this.args.signers ?? [];
    for (const s of extraSigners) {
      if (s.length !== SOLANA_PUBKEY_LEN) {
        return CommandResultFactory({
          error: new InvalidArgumentError(
            `Invalid signer length: ${s.length} bytes (expected ${SOLANA_PUBKEY_LEN})`,
          ),
        });
      }
    }
    if (extraSigners.length + 1 > V1_MAX_SIGNERS) {
      return CommandResultFactory({
        error: new InvalidArgumentError(
          `Too many signers: ${extraSigners.length + 1} (max ${V1_MAX_SIGNERS})`,
        ),
      });
    }

    const signerPubkey = await this._getSignerPubkey(derivationPath);
    if (!signerPubkey) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Error getting public key from device",
        ),
      });
    }

    const signers = [signerPubkey, ...extraSigners];

    // Preferred: finalised sRFC 38 layout (no length prefix). Older firmware
    // rejects it with 6a81 (header.length != trailing bytes), so fall back to
    // the pre-spec-update layout that still carries the 2-byte length prefix.
    const v1OCM = this._builder.buildV1(sendingData, signers, false);
    const v1Result = await this._sendAndWrap(v1OCM, paths);
    if (v1Result) {
      return v1Result;
    }
    this._logger?.warn(
      "[_runV1] V1 (no length prefix) not supported by device firmware, falling back to V1 (with length prefix)",
      { data: { signersCount: signers.length } },
    );

    const v1LegacyOCM = this._builder.buildV1(sendingData, signers, true);
    const v1LegacyResult = await this._sendAndWrap(v1LegacyOCM, paths);
    if (v1LegacyResult) {
      return v1LegacyResult;
    }
    this._logger?.warn(
      "[_runV1] V1 (with length prefix) not supported by device firmware, falling back to V0",
    );

    return this._runV0(sendingData, derivationPath, paths, signerPubkey);
  }

  private async _runV0(
    sendingData: Uint8Array,
    derivationPath: string,
    paths: number[],
    signerPubkey?: Uint8Array,
  ): SendSignMessageTaskRunFunctionReturn {
    const v0Max = MESSAGE_SIZE_LIMITS[SignMessageVersion.V0]!;
    if (sendingData.length > v0Max) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Message too long: ${sendingData.length} bytes (max is ${v0Max})`,
        ),
      });
    }

    const pubkey =
      signerPubkey ?? (await this._getSignerPubkey(derivationPath));
    if (!pubkey) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Error getting public key from device",
        ),
      });
    }

    const v0OCM = this._builder.buildV0(sendingData, pubkey);
    const v0Result = await this._sendAndWrap(v0OCM, paths);
    if (v0Result) {
      return v0Result;
    }
    this._logger?.warn(
      "[_runV0] V0 not supported by device firmware, falling back to Legacy",
    );

    return this._runLegacy(sendingData, paths);
  }

  /**
   * Legacy path: compact V0 OCM (no domain / signer fields) for
   * backward compatibility with old Solana app versions (< 1.8.0).
   * Still wrapped in the standard off-chain envelope.
   */
  private async _runLegacy(
    sendingData: Uint8Array,
    paths: number[],
  ): SendSignMessageTaskRunFunctionReturn {
    const legacyMax = MESSAGE_SIZE_LIMITS[SignMessageVersion.Legacy]!;
    if (sendingData.length > legacyMax) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Message too long: ${sendingData.length} bytes (max is ${legacyMax})`,
        ),
      });
    }

    const legacyOCM = this._builder.buildLegacy(sendingData);
    const result = await this._sendAndWrap(legacyOCM, paths);

    return (
      result ??
      CommandResultFactory({
        error: new InvalidStatusWordError("Invalid off-chain message header"),
      })
    );
  }

  private _isInvalidOffchainHeaderError(
    e: unknown,
  ): e is { _tag: string; errorCode: string } {
    if (!e || typeof e !== "object") return false;
    const obj = e as Record<string, unknown>;
    return (
      obj["_tag"] === "SolanaAppCommandError" &&
      typeof obj["errorCode"] === "string" &&
      (obj["errorCode"] as string).toLowerCase() === "6a81"
    );
  }

  private async _sendInChunks(
    apduPayload: Uint8Array,
  ): Promise<CommandResult<SignOffChainRawResponse, SolanaAppErrorCodes>> {
    const commandFactory: CommandFactory<
      SignOffChainRawResponse,
      SolanaAppErrorCodes
    > = (chunkArgs) => new SignOffChainMessageCommand(chunkArgs);

    return await new SendCommandInChunksTask<
      SignOffChainRawResponse,
      SolanaAppErrorCodes
    >(this.api, {
      data: apduPayload,
      commandFactory,
    }).run();
  }
}
