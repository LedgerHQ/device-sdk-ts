import {
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type Signature } from "@api/model/Signature";
import {
  SignEIP7702AuthorizationCommand,
  type SignEIP7702AuthorizationCommandResponse,
} from "@internal/app-binder/command/SignAuthorizationDelegationCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

import { SendCommandInChunksTask } from "./SendCommandInChunksTask";

const TAG_STRUCT_EIP7702_VERSION: number = 0x00;
const TAG_STRUCT_EIP7702_DELEGATE_ADDR: number = 0x01;
const TAG_STRUCT_EIP7702_CHAIN_ID: number = 0x02;
const TAG_STRUCT_EIP7702_NONCE: number = 0x03;

type SendSignAuthorizationDelegationTaskArgs = {
  derivationPath: string;
  chainId: number;
  address: string;
  nonce: number;
  logger?: LoggerPublisherService;
};

export class SendSignAuthorizationDelegationTask {
  private readonly _logger?: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendSignAuthorizationDelegationTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<CommandResult<Signature, EthErrorCodes>> {
    const { derivationPath, chainId, address, nonce } = this.args;
    this._logger?.debug("[run] Starting SendSignAuthorizationDelegationTask", {
      data: { derivationPath, chainId, address, nonce },
    });

    const paths = DerivationPathUtils.splitPath(derivationPath);

    const buffer = this.buildData(paths, chainId, address, nonce);

    this._logger?.debug("[run] Sending authorization delegation in chunks", {
      data: { bufferLength: buffer.length },
    });

    const result =
      await new SendCommandInChunksTask<SignEIP7702AuthorizationCommandResponse>(
        this.api,
        {
          data: buffer,
          commandFactory: (args) =>
            new SignEIP7702AuthorizationCommand({
              data: args.chunkedData,
              isFirstChunk: args.isFirstChunk,
            }),
        },
      ).run();

    if (!isSuccessCommandResult(result)) {
      this._logger?.error("[run] Failed to sign authorization delegation", {
        data: { error: result.error },
      });
      return result;
    }

    this._logger?.debug("[run] Authorization delegation signed successfully");
    return result.data.mapOrDefault(
      (data) => CommandResultFactory({ data }),
      CommandResultFactory({
        error: new InvalidStatusWordError("no signature returned"),
      }),
    );
  }

  buildData(
    paths: number[],
    chainId: number,
    address: string,
    nonce: number,
  ): Uint8Array {
    const builder = new ByteArrayBuilder();
    // add the derivation paths length
    builder.add8BitUIntToData(paths.length);
    // add every derivation path
    paths.forEach((path) => {
      builder.add32BitUIntToData(path);
    });

    // Send EIP7702 Auth structure
    const builderStruct = new ByteArrayBuilder();
    builderStruct.encodeInTLVFromBuffer(
      TAG_STRUCT_EIP7702_VERSION,
      Uint8Array.from([0x01]),
    );
    // Add address
    builderStruct.encodeInTLVFromHexa(
      TAG_STRUCT_EIP7702_DELEGATE_ADDR,
      address,
    );
    // Add chainId
    builderStruct.encodeInTLVFromUInt64(TAG_STRUCT_EIP7702_CHAIN_ID, chainId);
    // Add nonce
    builderStruct.encodeInTLVFromUInt64(TAG_STRUCT_EIP7702_NONCE, nonce);
    const structBuffer = builderStruct.build();

    return builder
      .add16BitUIntToData(structBuffer.length)
      .addBufferToData(structBuffer)
      .build();
  }
}
