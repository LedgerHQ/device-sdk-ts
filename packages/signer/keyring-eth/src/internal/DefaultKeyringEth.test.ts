import { ContextModule } from "@ledgerhq/context-module";
import { DeviceSdk, DeviceSessionId } from "@ledgerhq/device-sdk-core";
import { Container } from "inversify";

import { addressTypes } from "./address/di/addressTypes";
import { messageTypes } from "./message/di/messageTypes";
import { transactionTypes } from "./transaction/di/transactionTypes";
import { typedDataTypes } from "./typed-data/di/typedDataTypes";
import { Transaction, TypedData } from "..";
import { DefaultKeyringEth } from "./DefaultKeyringEth";

describe("DefaultKeyringEth", () => {
  let keyring: DefaultKeyringEth;
  const mock: Container = {
    get: jest.fn((id: symbol) => ({
      execute: jest.fn(() => {
        if (id === transactionTypes.SignTransactionUseCase) {
          return "transaction-result";
        } else if (id === messageTypes.SignMessageUseCase) {
          return "message-result";
        } else if (id === typedDataTypes.SignTypedDataUseCase) {
          return "typed-data-result";
        } else if (id === addressTypes.GetAddressUseCase) {
          return "address-result";
        }

        return "undefined-result";
      }),
    })),
  } as unknown as Container;

  beforeEach(() => {
    jest.clearAllMocks();

    const sdk = {} as DeviceSdk;
    const sessionId = "" as DeviceSessionId;
    const contextModule = {} as ContextModule;
    keyring = new DefaultKeyringEth({ sdk, sessionId, contextModule });
    keyring["_container"] = mock as unknown as Container;
  });

  describe("signTransaction", () => {
    it("should sign a transaction", async () => {
      // GIVEN
      const derivationPath = "derivationPath";
      const transaction = {} as Transaction;

      // WHEN
      const result = await keyring.signTransaction(derivationPath, transaction);

      // THEN
      expect(result).toBeDefined();
      expect(result).toBe("transaction-result");
      expect(mock.get).toHaveBeenCalledWith(
        transactionTypes.SignTransactionUseCase,
      );
    });
  });

  describe("signMessage", () => {
    it("should sign a message", async () => {
      // GIVEN
      const derivationPath = "derivationPath";
      const message = "message";

      // WHEN
      const result = await keyring.signMessage(derivationPath, message);

      // THEN
      expect(result).toBeDefined();
      expect(result).toBe("message-result");
      expect(mock.get).toHaveBeenCalledWith(messageTypes.SignMessageUseCase);
    });
  });

  describe("signTypedData", () => {
    it("should sign typed data", async () => {
      // GIVEN
      const derivationPath = "derivationPath";
      const typedData = {} as TypedData;

      // WHEN
      const result = await keyring.signTypedData(derivationPath, typedData);

      // THEN
      expect(result).toBeDefined();
      expect(result).toBe("typed-data-result");
      expect(mock.get).toHaveBeenCalledWith(
        typedDataTypes.SignTypedDataUseCase,
      );
    });
  });

  describe("getAddress", () => {
    it("should get an address", async () => {
      // GIVEN
      const derivationPath = "derivationPath";

      // WHEN
      const result = await keyring.getAddress(derivationPath);

      // THEN
      expect(result).toBeDefined();
      expect(result).toBe("address-result");
      expect(mock.get).toHaveBeenCalledWith(addressTypes.GetAddressUseCase);
    });
  });
});
