import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { KOMODO_PROFILE } from "@api/profiles/komodoProfile";
import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import { BtcLegacyAppBinder } from "@internal/app-binder/BtcLegacyAppBinder";
import { SaplingTransactionSerializer } from "@internal/app-binder/task/format/SaplingTransactionSerializer";
import { StandardTransactionSerializer } from "@internal/app-binder/task/format/StandardTransactionSerializer";
import { StandardTrustedInputSerializer } from "@internal/app-binder/task/format/StandardTrustedInputSerializer";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";
import { btcLegacyModuleFactory } from "@internal/btcLegacyModule";
import { btcLegacyTypes } from "@internal/btcLegacyTypes";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { GetExtendedPublicKeyUseCase } from "@internal/use-cases/address/GetExtendedPublicKeyUseCase";
import { SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

describe("btcLegacyModuleFactory", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
    container
      .bind(btcLegacyTypes.Dmk)
      .toConstantValue({} as DeviceManagementKit);
    container
      .bind(btcLegacyTypes.SessionId)
      .toConstantValue("session-id" as DeviceSessionId);
    container.bind(btcLegacyTypes.Profile).toConstantValue(LITECOIN_PROFILE);
    container.bind(btcLegacyTypes.DmkLoggerFactory).toConstantValue(vi.fn());
    container.loadSync(btcLegacyModuleFactory());
  });

  it("should bind the app binder", () => {
    expect(container.get(btcLegacyTypes.AppBinder)).toBeInstanceOf(
      BtcLegacyAppBinder,
    );
  });

  it("should bind the get address use case", () => {
    expect(container.get(btcLegacyTypes.GetAddressUseCase)).toBeInstanceOf(
      GetAddressUseCase,
    );
  });

  it("should bind the get extended public key use case", () => {
    expect(
      container.get(btcLegacyTypes.GetExtendedPublicKeyUseCase),
    ).toBeInstanceOf(GetExtendedPublicKeyUseCase);
  });

  it("should bind the sign transaction use case", () => {
    expect(container.get(btcLegacyTypes.SignTransactionUseCase)).toBeInstanceOf(
      SignTransactionUseCase,
    );
  });

  it("should bind the signing task", () => {
    expect(container.get(btcLegacyTypes.SignTransactionTask)).toBeInstanceOf(
      SignTransactionTask,
    );
  });

  it("should bind the standard format", () => {
    expect(container.get(btcLegacyTypes.TrustedInputSerializer)).toBeInstanceOf(
      StandardTrustedInputSerializer,
    );
    expect(container.get(btcLegacyTypes.TransactionSerializer)).toBeInstanceOf(
      StandardTransactionSerializer,
    );
  });

  it("should let a kit rebind the format", () => {
    const serializer = { serialize: () => [] };
    container
      .rebindSync(btcLegacyTypes.TrustedInputSerializer)
      .toConstantValue(serializer);

    expect(container.get(btcLegacyTypes.TrustedInputSerializer)).toBe(
      serializer,
    );
  });

  it("should bind the sapling format for a profile in that format", () => {
    container
      .rebindSync(btcLegacyTypes.Profile)
      .toConstantValue(KOMODO_PROFILE);

    expect(container.get(btcLegacyTypes.TransactionSerializer)).toBeInstanceOf(
      SaplingTransactionSerializer,
    );
  });
});
