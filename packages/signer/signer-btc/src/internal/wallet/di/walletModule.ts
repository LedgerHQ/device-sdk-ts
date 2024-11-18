import { ContainerModule } from "inversify";

import { walletTypes } from "@internal/wallet/di/walletTypes";
import { DefaultWalletBuilder } from "@internal/wallet/service/DefaultWalletBuilder";
import { DefaultWalletSerializer } from "@internal/wallet/service/DefaultWalletSerializer";

export const walletModuleFactory = () =>
  new ContainerModule(
    (
      bind,
      _unbind,
      _isBound,
      _rebind,
      _unbindAsync,
      _onActivation,
      _onDeactivation,
    ) => {
      bind(walletTypes.WalletBuilder).to(DefaultWalletBuilder);
      bind(walletTypes.WalletSerializer).to(DefaultWalletSerializer);
    },
  );
