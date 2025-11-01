import {
  type CommandResult,
  CommandResultFactory,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { EitherAsync } from "purify-ts";

import { type Psbt } from "@api/model/Psbt";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { DataStore } from "@internal/data-store/model/DataStore";
import {
  type DataStoreService,
  type PsbtCommitment,
} from "@internal/data-store/service/DataStoreService";
import { type Psbt as InternalPsbt } from "@internal/psbt/model/Psbt";
import type { PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { type InternalWallet } from "@internal/wallet/model/Wallet";

export type BuildPsbtTaskResult = {
  psbtCommitment: PsbtCommitment;
  dataStore: DataStore;
  psbt: InternalPsbt;
};

export class BuildPsbtTask {
  constructor(
    private readonly _args: {
      wallet: InternalWallet;
      psbt: Psbt;
    },
    private readonly _dataStoreService: DataStoreService,
    private readonly _psbtMapper: PsbtMapper,
    private readonly _dataStoreFactory = () => new DataStore(),
  ) {}

  async run(): Promise<CommandResult<BuildPsbtTaskResult, BtcErrorCodes>> {
    const dataStore = this._dataStoreFactory();
    let psbt: InternalPsbt;
    return await EitherAsync(async ({ liftEither }) => {
      // map the input PSBT (V1 or V2, string or byte array) into a normalized and parsed PSBTv2
      psbt = await liftEither(this._psbtMapper.map(this._args.psbt));
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
          data: {
            psbtCommitment,
            dataStore,
            psbt,
          },
        });
      },
    });
  }
}
