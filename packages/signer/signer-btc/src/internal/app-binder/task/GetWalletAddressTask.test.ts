import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type Wallet as InternalWallet } from "@internal/wallet/model/Wallet";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { type ContinueTask } from "./ContinueTask";
import { GetWalletAddressTask } from "./GetWalletAddressTask";

jest.mock("@ledgerhq/device-management-kit", () => {
  const originalModule = jest.requireActual("@ledgerhq/device-management-kit");
  return {
    ...originalModule,
    ApduParser: jest.fn().mockImplementation(() => ({
      encodeToString: jest.fn(() => "some address"),
    })),
  };
});

describe("GetWalletAddressTask", () => {
  describe("run", () => {
    it("should return a wallet address successfully", async () => {
      // given
      const api = {
        sendCommand: jest.fn().mockResolvedValueOnce(
          CommandResultFactory({
            data: Uint8Array.from([0x01, 0x02, 0x03]),
          }),
        ),
      } as unknown as InternalApi;

      const wallet = {
        hmac: Uint8Array.from([0x04]),
      } as unknown as InternalWallet;

      const walletSerializer = {
        getId: jest.fn().mockReturnValue(Uint8Array.from([0x05])),
      } as unknown as WalletSerializer;

      const dataStoreService = {
        merklizeWallet: jest.fn(),
      } as unknown as DataStoreService;

      const continueTaskFactory = () =>
        ({
          run: jest.fn().mockResolvedValue(
            CommandResultFactory({
              data: {
                data: Uint8Array.from([
                  0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf1,
                ]),
              },
            }),
          ),
        }) as unknown as ContinueTask;

      // when
      const result = await new GetWalletAddressTask(
        api,
        {
          checkOnDevice: true,
          wallet,
          change: false,
          addressIndex: 0,
        },
        walletSerializer,
        dataStoreService,
        continueTaskFactory,
      ).run();

      // then
      expect(walletSerializer.getId).toHaveBeenCalledWith(wallet);
      expect((api.sendCommand as jest.Mock).mock.calls[0][0].args).toEqual(
        expect.objectContaining({
          checkOnDevice: true,
          walletId: Uint8Array.from([0x05]),
          walletHmac: Uint8Array.from([0x04]),
          change: false,
          addressIndex: 0,
        }),
      );
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: {
            address: "some address",
          },
        }),
      );
    });

    it("should fail if ContinueTask fails", async () => {
      // given
      const api = {
        sendCommand: jest.fn(),
      } as unknown as InternalApi;

      const wallet = {
        hmac: Uint8Array.from([0x04]),
      } as unknown as InternalWallet;

      const walletSerializer = {
        getId: jest.fn().mockReturnValue(Uint8Array.from([0x05])),
      } as unknown as WalletSerializer;

      const dataStoreService = {
        merklizeWallet: jest.fn(),
      } as unknown as DataStoreService;

      const continueTaskFactory = () =>
        ({
          run: jest.fn().mockResolvedValue(
            CommandResultFactory({
              error: new InvalidStatusWordError("ContinueTask failed"),
            }),
          ),
        }) as unknown as ContinueTask;

      // when
      const result = await new GetWalletAddressTask(
        api,
        {
          checkOnDevice: true,
          wallet,
          change: false,
          addressIndex: 0,
        },
        walletSerializer,
        dataStoreService,
        continueTaskFactory,
      ).run();

      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("ContinueTask failed"),
        }),
      );
    });

    it("should fail with an invalid device response", async () => {
      // given
      const api = {
        sendCommand: jest.fn().mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError(
              "Invalid response from the device",
            ),
          }),
        ),
      } as unknown as InternalApi;

      const wallet = {
        hmac: Uint8Array.from([0x04]),
      } as unknown as InternalWallet;

      const walletSerializer = {
        getId: jest.fn().mockReturnValue(Uint8Array.from([0x05])),
      } as unknown as WalletSerializer;

      const dataStoreService = {
        merklizeWallet: jest.fn(),
      } as unknown as DataStoreService;

      const continueTaskFactory = () =>
        ({
          run: jest.fn().mockResolvedValue(
            CommandResultFactory({
              error: new InvalidStatusWordError(
                "Invalid response from the device",
              ),
            }),
          ),
        }) as unknown as ContinueTask;

      // when
      const result = await new GetWalletAddressTask(
        api,
        {
          checkOnDevice: true,
          wallet,
          change: false,
          addressIndex: 0,
        },
        walletSerializer,
        dataStoreService,
        continueTaskFactory,
      ).run();

      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Invalid response from the device"),
        }),
      );
    });
  });
});
