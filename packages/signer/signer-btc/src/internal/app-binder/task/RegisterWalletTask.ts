import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { RegisteredWallet, type WalletPolicy } from "@api/model/Wallet";
import { RegisterWalletAddressCommand } from "@internal/app-binder/command/RegisterWalletAddressCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import type { DataStoreService } from "@internal/data-store/service/DataStoreService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import type { WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import type { WalletSerializer } from "@internal/wallet/service/WalletSerializer";

export type RegisterWalletTaskArgs = {
  walletPolicy: WalletPolicy;
};

export type RegisterWalletTaskResult = CommandResult<
  RegisteredWallet,
  BtcErrorCodes
>;

export class RegisterWalletTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: RegisterWalletTaskArgs,
    private readonly _walletBuilder: WalletBuilder,
    private readonly _walletSerializer: WalletSerializer,
    private readonly _dataStoreService: DataStoreService,
    private readonly _continueTaskFactory = (
      api: InternalApi,
      dataStore: DataStore,
    ) => new ContinueTask(api, dataStore),
  ) {}

  async run(): Promise<RegisterWalletTaskResult> {
    const { walletPolicy } = this._args;

    const wallet: InternalWallet =
      this._walletBuilder.fromWalletPolicy(walletPolicy);

    const dataStore = new DataStore();
    this._dataStoreService.merklizeWallet(dataStore, wallet);

    const serializedWallet = this._walletSerializer.serialize(wallet);

    const registerCommandResult = await this._api.sendCommand(
      new RegisterWalletAddressCommand({
        walletPolicy: serializedWallet,
      }),
    );

    const continueTask = this._continueTaskFactory(this._api, dataStore);
    const result = await continueTask.run(registerCommandResult);

    if (isSuccessCommandResult(result)) {
      const registrationResult = BtcCommandUtils.getWalletRegistration(result);

      if (!isSuccessCommandResult(registrationResult)) {
        return CommandResultFactory({
          error: registrationResult.error,
        });
      }

      const { walletHmac } = registrationResult.data;

      return CommandResultFactory({
        data: new RegisteredWallet(
          walletPolicy.name,
          walletPolicy.descriptorTemplate,
          walletPolicy.keys,
          walletHmac,
        ),
      });
    }

    return result;
  }
}
