import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { addressTypes } from "./address/di/addressTypes";
import { messageTypes } from "./message/di/messageTypes";
import { transactionTypes } from "./transaction/di/transactionTypes";
import { typedDataTypes } from "./typed-data/di/typedDataTypes";
import { type TypedData } from "..";
import { DefaultSignerEth } from "./DefaultSignerEth";

describe("DefaultSignerEth", () => {
  let signer: DefaultSignerEth;
  const mock: Container = {
    get: vi.fn((id: symbol) => ({
      execute: vi.fn(() => {
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
    vi.clearAllMocks();

    const dmk = {} as DeviceManagementKit;
    const sessionId = "" as DeviceSessionId;
    const contextModule = {} as ContextModule;
    signer = new DefaultSignerEth({ dmk, sessionId, contextModule });
    signer["_container"] = mock as unknown as Container;
  });

  describe("signTransaction", () => {
    it("should sign a transaction", async () => {
      // GIVEN
      const derivationPath = "derivationPath";
      const transaction = new Uint8Array(0);

      // WHEN
      const result = await signer.signTransaction(derivationPath, transaction);

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
      const result = await signer.signMessage(derivationPath, message);

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
      const result = await signer.signTypedData(derivationPath, typedData);

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
      const result = await signer.getAddress(derivationPath);

      // THEN
      expect(result).toBeDefined();
      expect(result).toBe("address-result");
      expect(mock.get).toHaveBeenCalledWith(addressTypes.GetAddressUseCase);
    });
  });
});
