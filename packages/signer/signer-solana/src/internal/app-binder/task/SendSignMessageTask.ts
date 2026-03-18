import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { SignMessageVersion } from "@api/model/MessageOptions";
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
  LEGACY_OFFCHAINMSG_MAX_LEN,
  OffchainMessageBuilder,
  OFFCHAINMSG_MAX_V0_LEN,
  OFFCHAINMSG_MAX_V1_LEN,
} from "@internal/app-binder/services/OffchainMessageBuilder";

import {
  type CommandFactory,
  SendCommandInChunksTask,
} from "./SendCommandInChunksTask";

export { MessageFormat } from "@internal/app-binder/services/OffchainMessageBuilder";

const SIGNATURE_LENGTH = 64;

const MESSAGE_SIZE_LIMITS: Partial<Record<SignMessageVersion, number>> = {
  [SignMessageVersion.V1]: OFFCHAINMSG_MAX_V1_LEN,
  [SignMessageVersion.V0]: OFFCHAINMSG_MAX_V0_LEN,
  [SignMessageVersion.Legacy]: LEGACY_OFFCHAINMSG_MAX_LEN,
};

export type SendSignMessageTaskArgs = {
  sendingData: string | Uint8Array;
  derivationPath: string;
  version?: SignMessageVersion;
  appDomain?: string;
};

export type SendSignMessageTaskRunFunctionReturn = Promise<
  CommandResult<{ signature: string }, SolanaAppErrorCodes>
>;

export class SendSignMessageTask {
  private readonly _builder: OffchainMessageBuilder;

  constructor(
    private api: InternalApi,
    private args: SendSignMessageTaskArgs,
    private readonly bs58Encoder: Bs58Encoder = DefaultBs58Encoder,
  ) {
    this._builder = new OffchainMessageBuilder(args.appDomain);
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
      if (res.data.length !== SIGNATURE_LENGTH) {
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
    const signerPubkey = await this._getSignerPubkey(derivationPath);
    if (!signerPubkey) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Error getting public key from device",
        ),
      });
    }

    const v1OCM = this._builder.buildV1(sendingData, [signerPubkey]);
    const v1Result = await this._sendAndWrap(v1OCM, paths);

    return (
      v1Result ?? this._runV0(sendingData, derivationPath, paths, signerPubkey)
    );
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

    return v0Result ?? this._runLegacy(sendingData, paths);
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
}
