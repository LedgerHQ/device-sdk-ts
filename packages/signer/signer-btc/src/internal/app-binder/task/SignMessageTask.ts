import {
  type CommandResult,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { CHUNK_SIZE } from "@internal/app-binder/command/utils/constants";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";

export type SendSignMessageTaskArgs = {
  derivationPath: string;
  message: string;
};

export class SendSignMessageTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SendSignMessageTaskArgs,
    private readonly _dataStoreService: DataStoreService,
    private readonly _continueTaskFactory = (
      api: InternalApi,
      dataStore: DataStore,
    ) => new ContinueTask(api, dataStore),
  ) {}

  async run(): Promise<CommandResult<Signature, BtcErrorCodes>> {
    const { derivationPath, message } = this._args;

    const dataStore = new DataStore();

    const messageBuffer = new TextEncoder().encode(message);
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < messageBuffer.length; i += CHUNK_SIZE) {
      chunks.push(messageBuffer.subarray(i, i + CHUNK_SIZE));
    }

    const merkleRoot = this._dataStoreService.merklizeChunks(dataStore, chunks);

    const signMessageFirstCommandResponse = await this._api.sendCommand(
      new SignMessageCommand({
        derivationPath,
        messageLength: messageBuffer.length,
        messageMerkleRoot: merkleRoot,
      }),
    );
    const response = await this._continueTaskFactory(this._api, dataStore).run(
      signMessageFirstCommandResponse,
    );
    if (isSuccessCommandResult(response)) {
      return BtcCommandUtils.getSignature(response);
    }
    return response;
  }
}
