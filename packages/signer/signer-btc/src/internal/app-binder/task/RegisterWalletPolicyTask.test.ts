import {
  ApduResponse,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { type Mock } from "vitest";

import { type WalletPolicy } from "@api/model/Wallet";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { BtcCommandUtils } from "@internal/utils/BtcCommandUtils";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { type ContinueTask } from "./ContinueTask";
import { RegisterWalletPolicyTask } from "./RegisterWalletPolicyTask";

describe("RegisterWalletPolicy", () => {
  const walletPolicy: WalletPolicy = {
    name: "test",
    descriptorTemplate: "wsh(sortedmulti(2,@0/**,@1/**))",
    keys: [
      "tpubDEdzb1cDA9f3vpgz26SjuJ6yHmi2UdnjkXjhxLgPZbCHyMx7FCtmknp8VtQL3UPh82NtCkaE8onS3yM8sYaUXDL1v67odbabtWMX18SKcN2",
      "tpubDEPCJkjJ2ACsaJQ6Z6MAyRCFTjvpa7dvutUPSR5WKFssiwtoajTbkZrKfKGu7eWsdVAf2ZdZRfYNf8BQZr2TGZKGxXWqsMDUmHZ4qcbYcfZ",
    ],
  };

  const successResult = CommandResultFactory({
    data: new ApduResponse({
      statusCode: Uint8Array.from([0x90, 0x00]),
      data: Uint8Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 256),
      ),
    }),
  });

  let internalApi: { sendCommand: Mock };

  beforeEach(() => {
    internalApi = {
      sendCommand: vi.fn(),
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return a wallet identity", async () => {
    // given
    const walletBuilder = {
      fromWalletPolicy: vi.fn().mockReturnValue("InternalUnRegisteredWallet"),
    } as unknown as WalletBuilder;

    const dataStoreService = {
      merklizeWallet: vi.fn(),
    } as unknown as DataStoreService;

    const walletSerializer = {
      serialize: vi.fn().mockReturnValue(Uint8Array.from([0x01, 0x02, 0x03])),
    } as unknown as WalletSerializer;

    internalApi.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        data: Uint8Array.from([0x01, 0x02, 0x03]),
      }),
    );

    if (!isSuccessCommandResult(successResult)) {
      throw new Error("Invalid result");
    }

    const continueTaskFactory = () =>
      ({
        run: vi.fn().mockResolvedValueOnce(successResult),
      }) as unknown as ContinueTask;

    const task = new RegisterWalletPolicyTask(
      { walletPolicy },
      dataStoreService,
      walletBuilder as unknown as WalletBuilder,
      internalApi as unknown as InternalApi,
      walletSerializer,
      continueTaskFactory,
    );

    // when
    const result = await task.run();

    // then
    expect(result).toStrictEqual(
      BtcCommandUtils.getWalletIdentity(successResult),
    );
  });

  it("should return an error if Register wallet fails", async () => {
    // given
    const errorResult = CommandResultFactory({
      error: new UnknownDeviceExchangeError("Failed"),
    });

    const walletBuilder = {
      fromWalletPolicy: vi.fn().mockReturnValue("InternalUnRegisteredWallet"),
    } as unknown as WalletBuilder;

    const dataStoreService = {
      merklizeWallet: vi.fn(),
    } as unknown as DataStoreService;

    const walletSerializer = {
      serialize: vi.fn().mockReturnValue(Uint8Array.from([0x01, 0x02, 0x03])),
    } as unknown as WalletSerializer;

    internalApi.sendCommand.mockResolvedValueOnce(errorResult);

    const continueTaskFactory = () =>
      ({
        run: vi.fn().mockResolvedValueOnce(successResult),
      }) as unknown as ContinueTask;

    const task = new RegisterWalletPolicyTask(
      { walletPolicy },
      dataStoreService,
      walletBuilder as unknown as WalletBuilder,
      internalApi as unknown as InternalApi,
      walletSerializer,
      continueTaskFactory,
    );

    // when
    const result = await task.run();

    // then
    expect(result).toStrictEqual(errorResult);
  });

  it("should fail if ContinueTask fails", async () => {
    // given
    const errorResult = CommandResultFactory({
      error: new InvalidStatusWordError("ContinueTask failed"),
    });

    const walletBuilder = {
      fromWalletPolicy: vi.fn().mockReturnValue("InternalUnRegisteredWallet"),
    } as unknown as WalletBuilder;

    const dataStoreService = {
      merklizeWallet: vi.fn(),
    } as unknown as DataStoreService;

    const walletSerializer = {
      serialize: vi.fn().mockReturnValue(Uint8Array.from([0x01, 0x02, 0x03])),
    } as unknown as WalletSerializer;

    internalApi.sendCommand.mockResolvedValueOnce(errorResult);

    const continueTaskFactory = () =>
      ({
        run: vi.fn().mockResolvedValueOnce(errorResult),
      }) as unknown as ContinueTask;

    const task = new RegisterWalletPolicyTask(
      { walletPolicy },
      dataStoreService,
      walletBuilder as unknown as WalletBuilder,
      internalApi as unknown as InternalApi,
      walletSerializer,
      continueTaskFactory,
    );

    // when
    const result = await task.run();

    // then
    expect(result).toStrictEqual(errorResult);
  });
});
