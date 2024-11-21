import {
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type ClientCommandContext } from "@internal/app-binder/command/client-command-handlers/ClientCommandHandlersTypes";
import { ContinueCommand } from "@internal/app-binder/command/ContinueCommand";
import { ClientCommandInterpreter } from "@internal/app-binder/command/service/ClientCommandInterpreter";
import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
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

const CHUNK_SIZE = 64;

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

  async run(): Promise<CommandResult<Uint8Array, Error>> {
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

    const signMessageCommand = new SignMessageCommand({
      derivationPath,
      messageLength: messageBuffer.length,
      messageMerkleRoot: merkleRoot,
    });
    //@ts-expect-error
    let response: ApduResponse = await this.api.sendCommand(signMessageCommand);

    if (!CommandUtils.isContinueResponse(response)) {
      return CommandResultFactory<Uint8Array, Error>({
        data: response.data,
      });
    } else {
      while (CommandUtils.isContinueResponse(response)) {
        const deviceRequest = interpreter.getClientCommandPayload(
          response.data,
          commandHandlersContext,
        );

        if (deviceRequest.isLeft()) {
          return CommandResultFactory<Uint8Array, Error>({
            error: new InvalidStatusWordError(deviceRequest.extract().message),
          });
        } else {
          const payload = deviceRequest.extract() as Uint8Array;
          const responseToDevice = new ContinueCommand({
            payload,
          });
          //@ts-expect-error
          response = await this.api.sendCommand(responseToDevice);
        }
      }

      return CommandResultFactory<Uint8Array, Error>({
        data: response.data,
      });
    }
  }
}
