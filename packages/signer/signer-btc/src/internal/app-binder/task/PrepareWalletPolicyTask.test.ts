import {
  CommandResultFactory,
  type InternalApi,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { type Mock } from "vitest";

import {
  DefaultDescriptorTemplate,
  DefaultWallet,
  RegisteredWallet,
  type Wallet,
} from "@api/model/Wallet";
import { PrepareWalletPolicyTask } from "@internal/app-binder/task/PrepareWalletPolicyTask";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
const fromDefaultWalletMock = vi.fn();
const fromRegisteredWalletMock = vi.fn();

describe("PrepareWalletPolicyTask", () => {
  let internalApi: { sendCommand: Mock };
  const walletBuilder = {
    fromDefaultWallet: fromDefaultWalletMock,
    fromRegisteredWallet: fromRegisteredWalletMock,
  } as unknown as WalletBuilder;
  beforeEach(() => {
    internalApi = {
      sendCommand: vi.fn(),
    };
  });
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should return a builded wallet from a default one", async () => {
    // given
    const defaultWallet = new DefaultWallet(
      "49'/0'/0'",
      DefaultDescriptorTemplate.LEGACY,
    );
    const task = new PrepareWalletPolicyTask(
      internalApi as unknown as InternalApi,
      { wallet: defaultWallet },
      walletBuilder,
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
    internalApi.sendCommand.mockResolvedValueOnce(
      Promise.resolve(
        CommandResultFactory({
          data: {
            masterFingerprint: Uint8Array.from([0x42, 0x21, 0x12, 0x24]),
          },
        }),
      ),
    );
    const wallet = {} as Wallet;
    fromDefaultWalletMock.mockReturnValue(wallet);
    // when
    const result = await task.run();
    // then
    expect(fromDefaultWalletMock).toHaveBeenCalledWith(
      Uint8Array.from([0x42, 0x21, 0x12, 0x24]),
      "xPublicKey",
      defaultWallet,
    );
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: wallet,
      }),
    );
  });

  it("should return a builded wallet from a registered one", async () => {
    // given
    const registeredWallet = new RegisteredWallet(
      "walletName",
      DefaultDescriptorTemplate.LEGACY,
      ["key0", "key1"],
      Uint8Array.from([42]),
    );
    const task = new PrepareWalletPolicyTask(
      internalApi as unknown as InternalApi,
      { wallet: registeredWallet },
      walletBuilder,
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
    internalApi.sendCommand.mockResolvedValueOnce(
      Promise.resolve(
        CommandResultFactory({
          data: {
            masterFingerprint: Uint8Array.from([0x42, 0x21, 0x12, 0x24]),
          },
        }),
      ),
    );
    const wallet = {} as Wallet;
    fromRegisteredWalletMock.mockReturnValue(wallet);
    // when
    const result = await task.run();
    // then
    expect(fromRegisteredWalletMock).toHaveBeenCalledWith(registeredWallet);
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: wallet,
      }),
    );
  });

  it("should return an error if getMasterFingerprint failed", async () => {
    // given
    const defaultWallet = new DefaultWallet(
      "49'/0'/0'",
      DefaultDescriptorTemplate.LEGACY,
    );
    const task = new PrepareWalletPolicyTask(
      internalApi as unknown as InternalApi,
      { wallet: defaultWallet },
      walletBuilder,
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
    const result = await task.run();
    // then
    expect(result).toStrictEqual(CommandResultFactory({ error }));
  });

  it("should return an error if getExtendedPublicKey failed", async () => {
    // given
    const defaultWallet = new DefaultWallet(
      "49'/0'/0'",
      DefaultDescriptorTemplate.LEGACY,
    );
    const task = new PrepareWalletPolicyTask(
      internalApi as unknown as InternalApi,
      { wallet: defaultWallet },
      walletBuilder,
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
    const result = await task.run();
    // then
    expect(result).toStrictEqual(CommandResultFactory({ error }));
    expect(result).toStrictEqual(
      CommandResultFactory({
        error,
      }),
    );
  });
});
