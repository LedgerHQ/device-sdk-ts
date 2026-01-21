import {
  ApduResponse,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { RegisteredWallet, WalletPolicy } from "@api/model/Wallet";
import { type ContinueTask } from "@internal/app-binder/task/ContinueTask";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type Wallet } from "@internal/wallet/model/Wallet";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { RegisterWalletTask } from "./RegisterWalletTask";

const WALLET_POLICY = new WalletPolicy(
  "My Multisig",
  "wsh(sortedmulti(2,@0/**,@1/**))",
  [
    "[f5acc2fd/48'/1'/0'/2']tpubDFAqEGNyad35aBCKUAXbQGDjdVhNueno5ZZVEn3sQbW5ci457gLR7HyTmHBg93oourBssgUxuWz1jX5uhc1qaqFo9VsybY1J5FuedLfm4dK",
    "tpubDE7NQymr4AFtcJXi9TaWZtrhAdy8QyKmT4U6b9qYByAxCzoyMJ8zw5d8xVLVpbTRAEqP8pVUxjLE2vDt1rSFjaiS8DSz1QcNZ8D1qxUMx1g",
  ],
);

const WALLET_ID = Uint8Array.from([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
  0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a,
  0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20,
]);

const WALLET_HMAC = Uint8Array.from([
  0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2b, 0x2c, 0x2d,
  0x2e, 0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a,
  0x3b, 0x3c, 0x3d, 0x3e, 0x3f, 0x40,
]);

// Combined response data: walletId (32 bytes) + walletHmac (32 bytes)
const APDU_RESPONSE_DATA = new Uint8Array([...WALLET_ID, ...WALLET_HMAC]);

const SERIALIZED_WALLET = Uint8Array.from([0x01, 0x02, 0x03, 0x04]);

describe("RegisterWalletTask", () => {
  const apiMock = {
    sendCommand: vi.fn(),
  } as unknown as InternalApi;

  const mockInternalWallet = {
    name: WALLET_POLICY.name,
    descriptorTemplate: WALLET_POLICY.descriptorTemplate,
    keys: WALLET_POLICY.keys,
    hmac: new Uint8Array(32).fill(0),
    keysTree: { getRoot: vi.fn() },
    descriptorBuffer: new Uint8Array(),
  } as unknown as Wallet;

  const walletBuilderMock = {
    fromWalletPolicy: vi.fn().mockReturnValue(mockInternalWallet),
  } as unknown as WalletBuilder;

  const walletSerializerMock = {
    serialize: vi.fn().mockReturnValue(SERIALIZED_WALLET),
  } as unknown as WalletSerializer;

  const dataStoreServiceMock = {
    merklizeWallet: vi.fn(),
  } as unknown as DataStoreService;

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("run", () => {
    it("should successfully register a wallet and return RegisteredWallet with hmac", async () => {
      // GIVEN
      const args = {
        walletPolicy: WALLET_POLICY,
        loggerFactory: mockLoggerFactory,
      };

      const successResult = CommandResultFactory<ApduResponse, void>({
        data: new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: APDU_RESPONSE_DATA,
        }),
      });

      const continueTaskFactory = () =>
        ({
          run: vi.fn().mockReturnValue(successResult),
        }) as unknown as ContinueTask;

      // WHEN
      const result = await new RegisterWalletTask(
        apiMock,
        args,
        walletBuilderMock,
        walletSerializerMock,
        dataStoreServiceMock,
        continueTaskFactory,
      ).run();

      // THEN
      expect(walletBuilderMock.fromWalletPolicy).toHaveBeenCalledWith(
        WALLET_POLICY,
      );
      expect(dataStoreServiceMock.merklizeWallet).toHaveBeenCalledWith(
        expect.any(DataStore),
        mockInternalWallet,
      );
      expect(walletSerializerMock.serialize).toHaveBeenCalledWith(
        mockInternalWallet,
      );
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toBeInstanceOf(RegisteredWallet);
        expect(result.data).toEqual(
          new RegisteredWallet(
            WALLET_POLICY.name,
            WALLET_POLICY.descriptorTemplate,
            WALLET_POLICY.keys,
            WALLET_HMAC,
          ),
        );
      }
    });

    it("should return an error if the RegisterWalletAddressCommand fails", async () => {
      // GIVEN
      const args = {
        walletPolicy: WALLET_POLICY,
        loggerFactory: mockLoggerFactory,
      };

      const resultError = CommandResultFactory<ApduResponse, void>({
        error: new InvalidStatusWordError("Registration failed"),
      });

      const continueTaskFactory = () =>
        ({
          run: vi.fn().mockReturnValue(resultError),
        }) as unknown as ContinueTask;

      // WHEN
      const result = await new RegisterWalletTask(
        apiMock,
        args,
        walletBuilderMock,
        walletSerializerMock,
        dataStoreServiceMock,
        continueTaskFactory,
      ).run();

      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Registration failed"),
        }),
      );
    });

    it("should call sendCommand with the serialized wallet policy", async () => {
      // GIVEN
      const args = {
        walletPolicy: WALLET_POLICY,
        loggerFactory: mockLoggerFactory,
      };

      const successResult = CommandResultFactory<ApduResponse, void>({
        data: new ApduResponse({
          statusCode: new Uint8Array([0x90, 0x00]),
          data: APDU_RESPONSE_DATA,
        }),
      });

      const continueTaskFactory = () =>
        ({
          run: vi.fn().mockReturnValue(successResult),
        }) as unknown as ContinueTask;

      // WHEN
      await new RegisterWalletTask(
        apiMock,
        args,
        walletBuilderMock,
        walletSerializerMock,
        dataStoreServiceMock,
        continueTaskFactory,
      ).run();

      // THEN
      expect(apiMock.sendCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "registerWalletAddress",
        }),
      );
    });
  });
});
