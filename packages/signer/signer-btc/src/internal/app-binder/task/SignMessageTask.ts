import {
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
import { type BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { CHUNK_SIZE } from "@internal/app-binder/command/utils/constants";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";
import { MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";

const R_LENGTH = 32;
const S_LENGTH = 32;

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

  async run(): Promise<CommandResult<Signature, BitcoinAppErrorCodes>> {
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
      return this.parseBitcoinSignatureResponse(response.data);
    }
    return CommandResultFactory({
      error: new InvalidStatusWordError("Invalid response from the device"),
    });
  }

  private parseBitcoinSignatureResponse = (
    response: ApduResponse,
  ): CommandResult<Signature, BitcoinAppErrorCodes> => {
    const parser = new ApduParser(response);

    const v = parser.extract8BitUInt();
    if (v === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("V is missing"),
      });
    }

    const r = parser.encodeToHexaString(
      parser.extractFieldByLength(R_LENGTH),
      true,
    );
    if (!r) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("R is missing"),
      });
    }

    const s = parser.encodeToHexaString(
      parser.extractFieldByLength(S_LENGTH),
      true,
    );
    if (!s) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("S is missing"),
      });
    }

    return CommandResultFactory({
      data: {
        v,
        r,
        s,
      },
    });
  };
}
