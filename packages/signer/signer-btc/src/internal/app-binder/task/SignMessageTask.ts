import {
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type ClientCommandContext } from "@internal/app-binder/command/client-command-handlers/ClientCommandHandlersTypes";
import { ContinueCommand } from "@internal/app-binder/command/ContinueCommand";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import {
  SignMessageCommand,
  type SignMessageCommandResponse,
} from "@internal/app-binder/command/SignMessageCommand";
import { CHUNK_SIZE } from "@internal/app-binder/command/utils/constants";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";
import { MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { CommandUtils } from "@internal/utils/CommandUtils";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";

type SendSignMessageTaskArgs = {
  derivationPath: string;
  message: string;
};

export class SendSignMessageTask {
  private dataStoreService: DataStoreService;

  constructor(
    private api: InternalApi,
    private args: SendSignMessageTaskArgs,
  ) {
    const merkleTreeBuilder = new MerkleTreeBuilder(new Sha256HasherService());
    const merkleMapBuilder = new MerkleMapBuilder(merkleTreeBuilder);
    const walletSerializer = new DefaultWalletSerializer(
      new Sha256HasherService(),
    );

    this.dataStoreService = new DefaultDataStoreService(
      merkleTreeBuilder,
      merkleMapBuilder,
      walletSerializer,
      new Sha256HasherService(),
    );
  }

  async run(): Promise<CommandResult<Signature, Error>> {
    const { derivationPath, message } = this.args;

    const dataStore = new DataStore();

    const messageBuffer = new TextEncoder().encode(message);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < messageBuffer.length; i += CHUNK_SIZE) {
      chunks.push(messageBuffer.subarray(i, i + CHUNK_SIZE));
    }

    const merkleRoot = this.dataStoreService.merklizeChunks(dataStore, chunks);

    const interpreter = new ClientCommandInterpreter();

    const commandHandlersContext: ClientCommandContext = {
      dataStore,
      queue: [],
      yieldedResults: [],
    };

    const signMessageFirstCommandResponse = await this.api.sendCommand(
      new SignMessageCommand({
        derivationPath,
        messageLength: messageBuffer.length,
        messageMerkleRoot: merkleRoot,
      }),
    );

    if (
      isSuccessCommandResult(signMessageFirstCommandResponse) &&
      this.isSignature(signMessageFirstCommandResponse.data)
    ) {
      return CommandResultFactory({
        data: signMessageFirstCommandResponse.data,
      });
    }

    if (isSuccessCommandResult(signMessageFirstCommandResponse)) {
      let currentResponse = signMessageFirstCommandResponse;
      while (
        this.isApduResponse(currentResponse.data) &&
        CommandUtils.isContinueResponse(currentResponse.data)
      ) {
        const maybeCommandPayload = interpreter.getClientCommandPayload(
          currentResponse.data.data,
          commandHandlersContext,
        );
        if (maybeCommandPayload.isLeft()) {
          return CommandResultFactory({
            error: new InvalidStatusWordError(
              maybeCommandPayload.extract().message,
            ),
          });
        }

        const payload = maybeCommandPayload.extract();
        if (payload instanceof Uint8Array) {
          const nextResponse = await this.api.sendCommand(
            new ContinueCommand({
              payload,
            }),
          );
          if (!isSuccessCommandResult(nextResponse)) {
            return CommandResultFactory({
              error: new InvalidStatusWordError("Invalid response type"),
            });
          }
          if (this.isSignature(nextResponse.data)) {
            return CommandResultFactory({
              data: nextResponse.data,
            });
          }

          currentResponse = nextResponse;
        }
      }
    }
    return CommandResultFactory<Signature, Error>({
      error: new InvalidStatusWordError("Failed to send sign message command."),
    });
  }

  private isSignature = (
    response: SignMessageCommandResponse,
  ): response is Signature => {
    return (
      response &&
      typeof response === "object" &&
      "v" in response &&
      "r" in response &&
      "s" in response
    );
  };

  private isApduResponse = (
    response: SignMessageCommandResponse,
  ): response is ApduResponse => {
    return (
      response &&
      typeof response === "object" &&
      "statusCode" in response &&
      "data" in response
    );
  };
}
