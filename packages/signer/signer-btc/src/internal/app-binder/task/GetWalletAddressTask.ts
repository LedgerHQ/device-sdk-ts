import {
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type InternalApi } from "@ledgerhq/device-management-kit";

import { type WalletAddress } from "@api/model/Wallet";
import { type Wallet as ApiWallet } from "@api/model/Wallet";
import { GetWalletAddressCommand } from "@internal/app-binder/command/GetWalletAddressCommand";
import { type BtcErrorCodes } from "@internal/app-binder/command/utils/bitcoinAppErrors";
import { DataStore } from "@internal/data-store/model/DataStore";
import { Sha256HasherService } from "@internal/merkle-tree/service/Sha256HasherService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { ContinueTask } from "./ContinueTask";
import { PrepareWalletPolicyTask } from "./PrepareWalletPolicyTask";

export type SendGetWalletAddressTaskArgs = {
  display: boolean;
  wallet: ApiWallet;
  change: boolean;
  addressIndex: number;
};

export class GetWalletAddressTask {
  private readonly walletSerializer: WalletSerializer;
  private readonly dataStore: DataStore;

  constructor(
    private readonly api: InternalApi,
    private readonly args: SendGetWalletAddressTaskArgs,
    walletSerializerFromArg?: WalletSerializer,
    dataStoreFromArg?: DataStore,
  ) {
    this.walletSerializer =
      walletSerializerFromArg ||
      new DefaultWalletSerializer(new Sha256HasherService());
    this.dataStore = dataStoreFromArg || new DataStore();
  }

  private async prepareWalletPolicy(wallet: ApiWallet, api: InternalApi) {
    return new PrepareWalletPolicyTask(api, {
      wallet,
    }).run();
  }

  private async runGetWalletAddressTask(
    wallet: InternalWallet,
    walletSerializer: WalletSerializer,
    api: InternalApi,
    internalArgs: SendGetWalletAddressTaskArgs,
    dataStore: DataStore,
  ): Promise<CommandResult<WalletAddress, BtcErrorCodes>> {
    const { display, change, addressIndex } = internalArgs;

    const walletId = walletSerializer.serialize(wallet);

    const getWalletAddressInitialResponse = await api.sendCommand(
      new GetWalletAddressCommand({
        display,
        walletId,
        walletHmac: wallet.hmac,
        change,
        addressIndex,
      }),
    );

    const response = await new ContinueTask(api, dataStore).run(
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
    const walletPolicyResult = await this.prepareWalletPolicy(
      this.args.wallet,
      this.api,
    );

    if (!isSuccessCommandResult(walletPolicyResult)) {
      return walletPolicyResult;
    }

    return this.runGetWalletAddressTask(
      walletPolicyResult.data,
      this.walletSerializer,
      this.api,
      this.args,
      this.dataStore,
    );
  }
}
