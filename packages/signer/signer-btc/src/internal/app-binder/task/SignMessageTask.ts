import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { CHUNK_SIZE } from "@internal/app-binder/command/utils/constants";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";
import { MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";

export type SendSignMessageTaskArgs = {
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

  async run(): Promise<CommandResult<Signature, BtcErrorCodes>> {
    const { derivationPath, message } = this.args;

    const dataStore = new DataStore();

    const messageBuffer = new TextEncoder().encode(message);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < messageBuffer.length; i += CHUNK_SIZE) {
      chunks.push(messageBuffer.subarray(i, i + CHUNK_SIZE));
    }

    const merkleRoot = this.dataStoreService.merklizeChunks(dataStore, chunks);

    const signMessageFirstCommandResponse = await this.api.sendCommand(
      new SignMessageCommand({
        derivationPath,
        messageLength: messageBuffer.length,
        messageMerkleRoot: merkleRoot,
      }),
    );
    const response = await new ContinueTask(this.api).run(
      dataStore,
      signMessageFirstCommandResponse,
    );
    if (isSuccessCommandResult(response)) {
      return BtcCommandUtils.getSignature(response);
    }
    return CommandResultFactory({
      error: new InvalidStatusWordError("Invalid response from the device"),
    });
  }
}
