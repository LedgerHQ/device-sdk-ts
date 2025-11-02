import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type WalletIdentity, type WalletPolicy } from "@api/model/Wallet";
import { RegisterWalletPolicyCommand } from "@internal/app-binder/command/RegisterWalletPolicyCommand";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { ContinueTask } from "./ContinueTask";

export type RegisterWalletPolicyTaskResult = {
  dataStore: DataStore;
  walletIdentity: WalletIdentity;
};

export class RegisterWalletPolicyTask {
  constructor(
    private readonly _args: {
      walletPolicy: WalletPolicy;
    },
    private readonly _dataStoreService: DataStoreService,
    private readonly _walletBuilder: WalletBuilder,
    private readonly _api: InternalApi,
    private readonly _walletSerializer: WalletSerializer,
    private readonly _continueTaskFactory = (
      api: InternalApi,
      dataStore: DataStore,
    ) => new ContinueTask(api, dataStore),
  ) {}

  /**
   * Register a Wallet policy to get a WalletIdentity
   */
  async run() {
    const { walletPolicy } = this._args;

    const dataStore = new DataStore();

    const internalUnregWallet =
      this._walletBuilder.fromWalletPolicy(walletPolicy);

    // put wallet policy  in merkle maps to expose them to the device
    this._dataStoreService.merklizeWallet(dataStore, internalUnregWallet);

    const serializedWallet =
      this._walletSerializer.serialize(internalUnregWallet);

    const registerWalletResponse = await this._api.sendCommand(
      new RegisterWalletPolicyCommand({
        walletPolicy: serializedWallet,
      }),
    );
    const response = await this._continueTaskFactory(this._api, dataStore).run(
      registerWalletResponse,
    );

    if (isSuccessCommandResult(response)) {
      return BtcCommandUtils.getWalletIdentity(response);
    }

    return response;
  }
}
