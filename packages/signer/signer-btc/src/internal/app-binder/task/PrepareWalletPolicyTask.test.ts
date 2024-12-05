import {
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import {
  DefaultDescriptorTemplate,
  DefaultWallet,
  type Wallet,
} from "@api/model/Wallet";
import { PrepareWalletPolicyTask } from "@internal/app-binder/task/PrepareWalletPolicyTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
const fromDefaultWalletMock = jest.fn();
const merklizeWalletMock = jest.fn();

describe("PrepareWalletPolicyTask", () => {
  let internalApi: { sendCommand: jest.Mock };
  const walletBuilder = {
    fromDefaultWallet: fromDefaultWalletMock,
  } as unknown as WalletBuilder;
  const dataStoreService = {
    merklizeWallet: merklizeWalletMock,
  } as unknown as DataStoreService;
  beforeEach(() => {
    internalApi = {
      sendCommand: jest.fn(),
    };
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should return a filled data store", async () => {
    // given
    const defaultWallet = new DefaultWallet(
      "49'/0'/0'",
      DefaultDescriptorTemplate.LEGACY,
    );
    const task = new PrepareWalletPolicyTask(
      internalApi as unknown as InternalApi,
      walletBuilder,
      dataStoreService,
    );
    internalApi.sendCommand.mockResolvedValueOnce(
      Promise.resolve(
        CommandResultFactory({
          data: {
            masterFingerprint: Uint8Array.from([0x42, 0x21, 0x12, 0x24]),
          },
        }),
      ),
    );
    internalApi.sendCommand.mockResolvedValueOnce(
      Promise.resolve(
        CommandResultFactory({
          data: {
            extendedPublicKey: "xPublicKey",
          },
        }),
      ),
    );
    const wallet = {} as Wallet;
    fromDefaultWalletMock.mockReturnValue(wallet);
    // when
    const result = await task.run(defaultWallet);
    // then
    if (isSuccessCommandResult(result)) {
      expect(fromDefaultWalletMock).toHaveBeenCalledWith(
        Uint8Array.from([0x42, 0x21, 0x12, 0x24]),
        "xPublicKey",
        defaultWallet,
      );
      expect(merklizeWalletMock).toHaveBeenCalledWith(new DataStore(), wallet);
      expect(result.data).toBeInstanceOf(DataStore);
    } else {
      fail("Expected a success result, but the result was an error");
    }
  });

  it("should return an error if getMasterFingerprint failed", async () => {
    // given
    const defaultWallet = new DefaultWallet(
      "49'/0'/0'",
      DefaultDescriptorTemplate.LEGACY,
    );
    const task = new PrepareWalletPolicyTask(
      internalApi as unknown as InternalApi,
      walletBuilder,
      dataStoreService,
    );
    const error = new UnknownDeviceExchangeError("Failed");
    internalApi.sendCommand.mockResolvedValueOnce(
      Promise.resolve(
        CommandResultFactory({
          error,
        }),
      ),
    );
    // when
    const result = await task.run(defaultWallet);
    // then
    if (isSuccessCommandResult(result) === false) {
      expect(result.error).toStrictEqual(error);
    } else {
      fail("Expected an error, but the result was successful");
    }
  });

  it("should return an error if getExtendedPublicKey failed", async () => {
    // given
    const defaultWallet = new DefaultWallet(
      "49'/0'/0'",
      DefaultDescriptorTemplate.LEGACY,
    );
    const task = new PrepareWalletPolicyTask(
      internalApi as unknown as InternalApi,
      walletBuilder,
      dataStoreService,
    );
    const error = new UnknownDeviceExchangeError("Failed");
    internalApi.sendCommand.mockResolvedValueOnce(
      Promise.resolve(
        CommandResultFactory({
          data: {
            masterFingerprint: Uint8Array.from([0x42, 0x21, 0x12, 0x24]),
          },
        }),
      ),
    );
    internalApi.sendCommand.mockResolvedValueOnce(
      Promise.resolve(
        CommandResultFactory({
          error,
        }),
      ),
    );
    // when
    const result = await task.run(defaultWallet);
    // then
    if (isSuccessCommandResult(result) === false) {
      expect(result.error).toStrictEqual(error);
    } else {
      fail("Expected an error, but the result was successful");
    }
  });
});
