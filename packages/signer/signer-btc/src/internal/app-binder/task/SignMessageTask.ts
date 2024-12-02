import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
import { ClientCommandInterpreter } from "@internal/app-binder/command/utils/ClientCommandInterpreter";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";
import { MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
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

  async run(): Promise<CommandResult<Uint8Array, void>> {
    const { derivationPath, message } = this.args;

    const dataStore = new DataStore();

    const messageBuffer = new TextEncoder().encode(message);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < messageBuffer.length; i += CHUNK_SIZE) {
      chunks.push(messageBuffer.subarray(i, i + CHUNK_SIZE));
    }

    const merkleRoot = this.dataStoreService.merklizeChunks(dataStore, chunks);
    const interpreter = new ClientCommandInterpreter(dataStore);

    const signMessageCommand = new SignMessageCommand({
      derivationPath,
      messageLength: messageBuffer.length,
      messageMerkleRoot: merkleRoot,
    });

    try {
      //@ts-ignore
      await interpreter.execute(this.api, signMessageCommand);

      const yieldedResults = interpreter.getYieldedResults();
      if (yieldedResults.length === 0 || !yieldedResults[0]) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("No response data returned"),
        });
      }

      const resultData = yieldedResults[0];

      return CommandResultFactory({
        data: resultData,
      });
    } catch (error: unknown) {
      if (error instanceof InvalidStatusWordError) {
        return CommandResultFactory({ error });
      }
      if (error instanceof Error) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Failed to execute commands: ${error.message}`,
          ),
        });
      }
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Failed to execute commands: Unknown error`,
        ),
      });
    }
  }
}
