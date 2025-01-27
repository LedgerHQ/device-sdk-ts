import {
  type CommandResult,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type InternalApi } from "@ledgerhq/device-management-kit";

import { type WalletAddress } from "@api/model/Wallet";
import { GetWalletAddressCommand } from "@internal/app-binder/command/GetWalletAddressCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { ContinueTask } from "./ContinueTask";

export type SendGetWalletAddressTaskArgs = {
  checkOnDevice: boolean;
  wallet: InternalWallet;
  change: boolean;
  addressIndex: number;
};

export class GetWalletAddressTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SendGetWalletAddressTaskArgs,
    private readonly _walletSerializer: WalletSerializer,
    private readonly _dataStoreService: DataStoreService,
    private readonly _continueTaskFactory = (
      api: InternalApi,
      dataStore: DataStore,
    ) => new ContinueTask(api, dataStore),
    private readonly _getAddress = BtcCommandUtils.getAddress,
  ) {}

  async run(): Promise<CommandResult<WalletAddress, BtcErrorCodes>> {
    const { checkOnDevice, change, addressIndex, wallet } = this._args;

    const dataStore = new DataStore();

    this._dataStoreService.merklizeWallet(dataStore, wallet);

    const walletId = this._walletSerializer.getId(wallet);

    const getWalletAddressInitialResponse = await this._api.sendCommand(
      new GetWalletAddressCommand({
        checkOnDevice,
        walletId,
        walletHmac: wallet.hmac,
        change,
        addressIndex,
      }),
    );

    const response = await this._continueTaskFactory(this._api, dataStore).run(
      getWalletAddressInitialResponse,
    );

    if (isSuccessCommandResult(response)) {
      return this._getAddress(response);
    }

    return response;
  }
}
