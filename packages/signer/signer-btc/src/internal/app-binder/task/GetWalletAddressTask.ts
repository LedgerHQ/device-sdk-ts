import {
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type InternalApi } from "@ledgerhq/device-management-kit";

import { type WalletAddress } from "@api/model/Wallet";
import { GetWalletAddressCommand } from "@internal/app-binder/command/GetWalletAddressCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { DataStore } from "@internal/data-store/model/DataStore";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { type Wallet } from "@internal/wallet/model/Wallet";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { ContinueTask } from "./ContinueTask";
import { PrepareWalletPolicyTask } from "./PrepareWalletPolicyTask";

export type SendGetWalletAddressTaskArgs = {
  display: boolean;
  wallet: Wallet;
  change: boolean;
  addressIndex: number;
};

export class GetWalletAddressTask {
  private readonly _walletSerializer: WalletSerializer;
  private readonly _dataStore: DataStore;

  constructor(
    private api: InternalApi,
    private args: SendGetWalletAddressTaskArgs,
    walletSerializer?: WalletSerializer,
    dataStore?: DataStore,
  ) {
    this._walletSerializer =
      walletSerializer ||
      new DefaultWalletSerializer(new Sha256HasherService());
    this._dataStore = dataStore || new DataStore();
  }

  private async runPrepareWalletPolicy() {
    return new PrepareWalletPolicyTask(this.api, {
      wallet: this.args.wallet,
    }).run();
  }

  private async runGetWalletAddressTask(
    wallet: Wallet,
  ): Promise<CommandResult<WalletAddress, BtcErrorCodes>> {
    const { display, change, addressIndex } = this.args;

    const walletId = this._walletSerializer.serialize(wallet);

    const getWalletAddressInitialResponse = await this.api.sendCommand(
      new GetWalletAddressCommand({
        display,
        walletId,
        walletHmac: wallet.hmac,
        change,
        addressIndex,
      }),
    );
    const response = await new ContinueTask(this.api, this._dataStore).run(
      getWalletAddressInitialResponse,
    );
    if (isSuccessCommandResult(response)) {
      return BtcCommandUtils.getAddress(response);
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("Invalid response from the device"),
    });
  }

  async run(): Promise<CommandResult<WalletAddress, BtcErrorCodes>> {
    const walletPolicyResult = await this.runPrepareWalletPolicy();
    if (!isSuccessCommandResult(walletPolicyResult)) {
      return walletPolicyResult;
    }

    return this.runGetWalletAddressTask(walletPolicyResult.data);
  }
}
