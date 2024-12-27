import {
  ApduResponse,
  CommandResultFactory,
  type InternalApi,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import { type DefaultWallet } from "@api/model/Wallet";
import { SignPsbtCommand } from "@internal/app-binder/command/SignPsbtCommand";
import { BuildPsbtTask } from "@internal/app-binder/task/BuildPsbtTask";
import { ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { PrepareWalletPolicyTask } from "@internal/app-binder/task/PrepareWalletPolicyTask";
import { SignPsbtTask } from "@internal/app-binder/task/SignPsbtTask";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

const mockRunBuildPsbt = jest.fn();
const mockRunPrepareWallet = jest.fn();
const mockRunContinue = jest.fn(() =>
  CommandResultFactory({
    data: new ApduResponse({
      statusCode: Uint8Array.from([0xe0, 0x00]),
      data: Uint8Array.from([]),
    }),
  }),
);

jest.mock("@internal/app-binder/task/BuildPsbtTask", () => ({
  BuildPsbtTask: jest.fn().mockImplementation(() => ({
    run: mockRunBuildPsbt,
  })),
}));
jest.mock("@internal/app-binder/task/ContinueTask", () => ({
  ContinueTask: jest.fn().mockImplementation(() => ({
    run: mockRunContinue,
  })),
}));
jest.mock("@internal/app-binder/task/PrepareWalletPolicyTask", () => ({
  PrepareWalletPolicyTask: jest.fn().mockImplementation(() => ({
    run: mockRunPrepareWallet,
  })),
}));

describe("SignPsbtTask", () => {
  describe("run", () => {
    it("should call all tasks", async () => {
      // given
      const api = {
        sendCommand: jest.fn(),
      } as unknown as InternalApi;
      const psbt = "";
      const wallet = {} as DefaultWallet;
      const walletSerializer = {
        getId: jest.fn(() => Uint8Array.from([0x05])),
      } as unknown as WalletSerializer;
      mockRunBuildPsbt.mockReturnValue(
        CommandResultFactory({
          data: {
            psbtCommitment: {
              inputsRoot: Uint8Array.from([0x01]),
              outputsRoot: Uint8Array.from([0x02]),
              globalCommitment: Uint8Array.from([0x03]),
            },
            inputsCount: 42,
            outputsCount: 42,
          },
        }),
      );
      mockRunPrepareWallet.mockReturnValue(
        CommandResultFactory({
          data: {
            hmac: Uint8Array.from([0x04]),
          },
        }),
      );

      // when
      await new SignPsbtTask(
        api,
        {
          psbt,
          wallet,
        },
        walletSerializer,
      ).run();
      // then
      expect(BuildPsbtTask).toHaveBeenCalled();
      expect(ContinueTask).toHaveBeenCalled();
      expect(PrepareWalletPolicyTask).toHaveBeenCalled();
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignPsbtCommand({
          globalCommitments: Uint8Array.from([0x03]),
          inputsCount: 42,
          inputsCommitments: Uint8Array.from([0x01]),
          outputsCount: 42,
          outputsCommitments: Uint8Array.from([0x02]),
          walletId: Uint8Array.from([0x05]),
          walletHmac: Uint8Array.from([0x04]),
        }),
      );
    });
  });
  describe("errors", () => {
    it("should return an error if build psbt fails", async () => {
      // given
      const api = {
        sendCommand: jest.fn(),
      } as unknown as InternalApi;
      const psbt = "";
      const wallet = {} as DefaultWallet;
      mockRunPrepareWallet.mockReturnValue(
        CommandResultFactory({
          data: {},
        }),
      );
      mockRunBuildPsbt.mockReturnValue(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Failed"),
        }),
      );
      // when
      const result = await new SignPsbtTask(api, {
        psbt,
        wallet,
      }).run();
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Failed"),
        }),
      );
    });
    it("should return an error if prepare wallet fails", async () => {
      // given
      const api = {
        sendCommand: jest.fn(),
      } as unknown as InternalApi;
      const psbt = "";
      const wallet = {} as DefaultWallet;
      mockRunBuildPsbt.mockReturnValue(
        CommandResultFactory({
          data: {},
        }),
      );
      mockRunPrepareWallet.mockReturnValue(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Failed"),
        }),
      );
      // when
      const result = await new SignPsbtTask(api, {
        psbt,
        wallet,
      }).run();
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Failed"),
        }),
      );
    });
    it("should return an error if continue task fails", async () => {
      // given
      const api = {
        sendCommand: jest.fn(),
      } as unknown as InternalApi;
      const psbt = "";
      const wallet = {} as DefaultWallet;
      const walletSerializer = {
        getId: jest.fn(() => Uint8Array.from([0x05])),
      } as unknown as WalletSerializer;
      mockRunContinue.mockReturnValue(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Failed"),
        }),
      );
      mockRunPrepareWallet.mockReturnValue(
        CommandResultFactory({
          data: {},
        }),
      );
      mockRunBuildPsbt.mockReturnValue(
        CommandResultFactory({
          data: {
            psbtCommitment: {},
          },
        }),
      );
      // when
      const result = await new SignPsbtTask(
        api,
        {
          psbt,
          wallet,
        },
        walletSerializer,
      ).run();
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Failed"),
        }),
      );
    });
  });
});
