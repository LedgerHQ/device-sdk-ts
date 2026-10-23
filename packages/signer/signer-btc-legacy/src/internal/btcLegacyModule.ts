import { ContainerModule } from "inversify";

import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { StandardTransactionSerializer } from "@internal/app-binder/task/format/StandardTransactionSerializer";
import { StandardTrustedInputSerializer } from "@internal/app-binder/task/format/StandardTrustedInputSerializer";
import { GetTrustedInputTask } from "@internal/app-binder/task/GetTrustedInputTask";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { GetExtendedPublicKeyUseCase } from "@internal/use-cases/address/GetExtendedPublicKeyUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

export const btcLegacyModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(btcLegacyTypes.AppBinder).to(BtcLegacyAppBinder);
    bind(btcLegacyTypes.GetAddressUseCase).to(GetAddressUseCase);
    bind(btcLegacyTypes.GetExtendedPublicKeyUseCase).to(
      GetExtendedPublicKeyUseCase,
    );
    bind(btcLegacyTypes.SignTransactionUseCase).to(SignTransactionUseCase);
    bind(btcLegacyTypes.GetTrustedInputTask).to(GetTrustedInputTask);
    bind(btcLegacyTypes.SignTransactionTask).to(SignTransactionTask);
    bind(btcLegacyTypes.TrustedInputSerializer).to(
      StandardTrustedInputSerializer,
    );
    bind(btcLegacyTypes.TransactionSerializer).to(
      StandardTransactionSerializer,
    );
  });
