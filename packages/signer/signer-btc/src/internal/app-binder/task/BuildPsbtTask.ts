import {
  type CommandResult,
  CommandResultFactory,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { EitherAsync } from "purify-ts";

import { type Psbt } from "@api/model/Psbt";
import { type BitcoinAppErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { DataStore } from "@internal/data-store/model/DataStore";
import {
  type DataStoreService,
  type PsbtCommitment,
} from "@internal/data-store/service/DataStoreService";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";
import { MerkleMapBuilder } from "@internal/merkle-tree/service/MerkleMapBuilder";
import { MerkleTreeBuilder } from "@internal/merkle-tree/service/MerkleTreeBuilder";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { DefaultKeySerializer } from "@internal/psbt/service/key/DefaultKeySerializer";
import { DefaultKeyPairSerializer } from "@internal/psbt/service/key-pair/DefaultKeyPairSerializer";
import { DefaultPsbtMapper } from "@internal/psbt/service/psbt/DefaultPsbtMapper";
import { DefaultPsbtSerializer } from "@internal/psbt/service/psbt/DefaultPsbtSerializer";
import { DefaultPsbtV2Normalizer } from "@internal/psbt/service/psbt/DefaultPsbtV2Normalizer";
import type { PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { DefaultValueFactory } from "@internal/psbt/service/value/DefaultValueFactory";
import { DefaultValueParser } from "@internal/psbt/service/value/DefaultValueParser";
import { type Wallet } from "@internal/wallet/model/Wallet";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";

type BuildPsbtTaskResponse = {
  psbtCommitment: PsbtCommitment;
  dataStore: DataStore;
};

export class BuildPsbtTask {
  private readonly _dataStoreService: DataStoreService;
  private readonly _psbtMapper: PsbtMapper;

  constructor(
    private readonly _args: {
      wallet: Wallet;
      psbt: Psbt;
    },
    psbtMapper?: PsbtMapper,
    dataStoreService?: DataStoreService,
  ) {
    const valueParser = new DefaultValueParser();
    const merkleTreeBuilder = new MerkleTreeBuilder(new Sha256HasherService());
    const merkleMapBuilder = new MerkleMapBuilder(merkleTreeBuilder);
    const hasher = new Sha256HasherService();

    this._psbtMapper =
      psbtMapper ||
      new DefaultPsbtMapper(
        new DefaultPsbtSerializer(
          valueParser,
          new DefaultKeyPairSerializer(new DefaultKeySerializer()),
        ),
        new DefaultPsbtV2Normalizer(valueParser, new DefaultValueFactory()),
      );
    this._dataStoreService =
      dataStoreService ||
      new DefaultDataStoreService(
        merkleTreeBuilder,
        merkleMapBuilder,
        new DefaultWalletSerializer(hasher),
        hasher,
      );
  }

  async run(): Promise<
    CommandResult<BuildPsbtTaskResponse, BitcoinAppErrorCodes>
  > {
    const dataStore = new DataStore();
    return await EitherAsync(async ({ liftEither }) => {
      // map the input PSBT (V1 or V2, string or byte array) into a normalized and parsed PSBTv2
      const psbt = await liftEither(this._psbtMapper.map(this._args.psbt));
      // put wallet policy and PSBT in merkle maps to expose them to the device
      this._dataStoreService.merklizeWallet(dataStore, this._args.wallet);
      return liftEither(this._dataStoreService.merklizePsbt(dataStore, psbt));
    }).caseOf({
      Left: (error) => {
        return CommandResultFactory({
          error: new UnknownDeviceExchangeError({ error }),
        });
      },
      Right: (psbtCommitment) => {
        return CommandResultFactory({
          data: { psbtCommitment, dataStore },
        });
      },
    });
  }
}
