import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import type { ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { SupportedChainIds } from "@/safe/constant/SupportedChainIds";
import { SafeTransactionContextLoader } from "@/safe/domain/SafeTransactionContextLoader";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import type { TransactionContext } from "@/shared/model/TransactionContext";
import type { TransactionDataSource } from "@/transaction/data/TransactionDataSource";

describe("SafeTransactionContextLoader", () => {
  const getTransactionDescriptorsMock = vi.fn();
  const getProxyDelegateCallMock = vi.fn();
  const mockTransactionDataSource: TransactionDataSource = {
    getTransactionDescriptors: getTransactionDescriptorsMock,
  };
  const mockProxyDataSource: ProxyDataSource = {
    getProxyDelegateCall: getProxyDelegateCallMock,
    getProxyImplementationAddress: vi.fn(),
  };
  const loader = new SafeTransactionContextLoader(
    mockTransactionDataSource,
    mockProxyDataSource,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("basic validation", () => {
    it("should return an empty array if no destination address is provided", async () => {
      // GIVEN
      const transaction = {} as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
      expect(getTransactionDescriptorsMock).not.toHaveBeenCalled();
      expect(getProxyDelegateCallMock).not.toHaveBeenCalled();
    });

    it("should return an empty array if 'to' is undefined", async () => {
      // GIVEN
      const transaction = { to: undefined, data: "0x" } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
      expect(getTransactionDescriptorsMock).not.toHaveBeenCalled();
      expect(getProxyDelegateCallMock).not.toHaveBeenCalled();
    });

    it("should return an empty array if device model is NANO_S", async () => {
      // GIVEN
      const transaction = {
        deviceModelId: DeviceModelId.NANO_S,
        to: "0x7",
        chainId: SupportedChainIds.BASE,
        data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xaf68b302",
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
      expect(getTransactionDescriptorsMock).not.toHaveBeenCalled();
      expect(getProxyDelegateCallMock).not.toHaveBeenCalled();
    });
  });

  describe("chain ID validation", () => {
    const supportedChainIds = [
      { name: "BASE", chainId: SupportedChainIds.BASE },
      { name: "OPTIMISM", chainId: SupportedChainIds.OPTIMISM },
      { name: "ARBITRUM", chainId: SupportedChainIds.ARBITRUM },
      { name: "POLYGON", chainId: SupportedChainIds.POLYGON },
    ];

    test.each(supportedChainIds)(
      "should proceed with processing for supported chain ID: $name ($chainId)",
      async ({ chainId }) => {
        // GIVEN
        getProxyDelegateCallMock.mockResolvedValue(
          Left(new Error("proxy error")),
        );
        const transaction = {
          to: "0x7",
          chainId,
          data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
          selector: "0xaf68b302",
          deviceModelId: DeviceModelId.STAX,
        } as TransactionContext;

        // WHEN
        await loader.load(transaction);

        // THEN
        expect(getProxyDelegateCallMock).toHaveBeenCalledWith({
          calldata: transaction.data,
          proxyAddress: transaction.to,
          chainId: transaction.chainId,
          challenge: "",
        });
      },
    );

    const unsupportedChainIds = [
      { name: "Ethereum Mainnet", chainId: 1 },
      { name: "Binance Smart Chain", chainId: 56 },
      { name: "Avalanche", chainId: 43114 },
      { name: "Random chain", chainId: 999999 },
    ];

    test.each(unsupportedChainIds)(
      "should return empty array for unsupported chain ID: $name ($chainId)",
      async ({ chainId }) => {
        // GIVEN
        const transaction = {
          to: "0x7",
          chainId,
          data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
          selector: "0xaf68b302",
          deviceModelId: DeviceModelId.STAX,
        } as TransactionContext;

        // WHEN
        const result = await loader.load(transaction);

        // THEN
        expect(result).toEqual([]);
        expect(getTransactionDescriptorsMock).not.toHaveBeenCalled();
        expect(getProxyDelegateCallMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("selector validation", () => {
    it("should return an error if selector is invalid", async () => {
      // GIVEN
      const transaction = {
        to: "0x7",
        chainId: SupportedChainIds.BASE,
        data: "0xzf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xzf68b302", // Invalid hex
        deviceModelId: DeviceModelId.STAX,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Invalid selector"),
        },
      ]);
      expect(getTransactionDescriptorsMock).not.toHaveBeenCalled();
      expect(getProxyDelegateCallMock).not.toHaveBeenCalled();
    });
  });

  describe("proxy delegate call scenarios", () => {
    it("should return an error when proxy delegate call fails", async () => {
      // GIVEN
      getProxyDelegateCallMock.mockResolvedValue(
        Left(new Error("proxy delegate call error")),
      );
      const transaction = {
        to: "0x7",
        chainId: SupportedChainIds.BASE,
        data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xaf68b302",
        deviceModelId: DeviceModelId.STAX,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(getProxyDelegateCallMock).toHaveBeenCalledWith({
        calldata: transaction.data,
        proxyAddress: transaction.to,
        chainId: transaction.chainId,
        challenge: "",
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] TransactionContextLoader: Unable to fetch contexts from contract address 0x7",
          ),
        },
      ]);
      expect(getTransactionDescriptorsMock).not.toHaveBeenCalled();
    });

    it("should return an error when proxy delegate call succeeds but no delegate addresses are found", async () => {
      // GIVEN
      getProxyDelegateCallMock.mockResolvedValue(
        Right({
          delegateAddresses: [], // Empty delegate addresses array
          signedDescriptor: "0x1234567890abcdef",
        }),
      );
      const transaction = {
        to: "0x7",
        chainId: SupportedChainIds.BASE,
        data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xaf68b302",
        deviceModelId: DeviceModelId.STAX,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(getProxyDelegateCallMock).toHaveBeenCalledWith({
        calldata: transaction.data,
        proxyAddress: transaction.to,
        chainId: transaction.chainId,
        challenge: "",
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] TransactionContextLoader: No delegate address found for proxy 0x7",
          ),
        },
      ]);
      expect(getTransactionDescriptorsMock).not.toHaveBeenCalled();
    });

    it("should return an error when proxy delegate call succeeds but transaction descriptors for resolved address fail", async () => {
      // GIVEN
      getProxyDelegateCallMock.mockResolvedValue(
        Right({
          delegateAddresses: ["0xResolvedAddress"],
          signedDescriptor: "0x1234567890abcdef",
        }),
      );
      getTransactionDescriptorsMock.mockResolvedValue(
        Left(new Error("transaction descriptors error")),
      );
      const transaction = {
        to: "0x7",
        chainId: SupportedChainIds.BASE,
        data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xaf68b302",
        deviceModelId: DeviceModelId.STAX,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(getProxyDelegateCallMock).toHaveBeenCalledWith({
        calldata: transaction.data,
        proxyAddress: transaction.to,
        chainId: transaction.chainId,
        challenge: "",
      });
      expect(getTransactionDescriptorsMock).toHaveBeenCalledWith({
        deviceModelId: transaction.deviceModelId,
        address: "0xResolvedAddress",
        chainId: transaction.chainId,
        selector: transaction.selector,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] TransactionContextLoader: Unable to fetch contexts from contract address using proxy delegate call 0xResolvedAddress",
          ),
        },
      ]);
    });

    it("should return an error when proxy delegate call succeeds but transaction descriptors return empty array", async () => {
      // GIVEN
      getProxyDelegateCallMock.mockResolvedValue(
        Right({
          delegateAddresses: ["0xResolvedAddress"],
          signedDescriptor: "0x1234567890abcdef",
        }),
      );
      getTransactionDescriptorsMock.mockResolvedValue(Right([])); // Empty array
      const transaction = {
        to: "0x7",
        chainId: SupportedChainIds.BASE,
        data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xaf68b302",
        deviceModelId: DeviceModelId.STAX,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(getProxyDelegateCallMock).toHaveBeenCalledWith({
        calldata: transaction.data,
        proxyAddress: transaction.to,
        chainId: transaction.chainId,
        challenge: "",
      });
      expect(getTransactionDescriptorsMock).toHaveBeenCalledWith({
        deviceModelId: transaction.deviceModelId,
        address: "0xResolvedAddress",
        chainId: transaction.chainId,
        selector: transaction.selector,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] TransactionContextLoader: Unable to fetch contexts from contract address using proxy delegate call 0xResolvedAddress",
          ),
        },
      ]);
    });
  });

  describe("successful scenarios", () => {
    it("should return proxy delegate call context and transaction descriptors on success", async () => {
      // GIVEN
      getProxyDelegateCallMock.mockResolvedValue(
        Right({
          delegateAddresses: ["0xResolvedAddress"],
          signedDescriptor: "0x1234567890abcdef",
        }),
      );
      getTransactionDescriptorsMock.mockResolvedValue(
        Right([
          {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "1234567890",
          },
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "deadbeef",
          },
        ]),
      );
      const transaction = {
        to: "0x7",
        chainId: SupportedChainIds.BASE,
        data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xaf68b302",
        deviceModelId: DeviceModelId.STAX,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(getProxyDelegateCallMock).toHaveBeenCalledWith({
        calldata: transaction.data,
        proxyAddress: transaction.to,
        chainId: transaction.chainId,
        challenge: "",
      });
      expect(getTransactionDescriptorsMock).toHaveBeenCalledWith({
        deviceModelId: transaction.deviceModelId,
        address: "0xResolvedAddress",
        chainId: transaction.chainId,
        selector: transaction.selector,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.PROXY_DELEGATE_CALL,
          payload: "0x",
        },
        {
          type: ClearSignContextType.TRANSACTION_INFO,
          payload: "1234567890",
        },
        {
          type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          payload: "deadbeef",
        },
      ]);
    });

    it("should handle multiple delegate addresses by using the first one", async () => {
      // GIVEN
      getProxyDelegateCallMock.mockResolvedValue(
        Right({
          delegateAddresses: [
            "0xFirstAddress",
            "0xSecondAddress",
            "0xThirdAddress",
          ],
          signedDescriptor: "0x1234567890abcdef",
        }),
      );
      getTransactionDescriptorsMock.mockResolvedValue(
        Right([
          {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "transaction-info",
          },
        ]),
      );
      const transaction = {
        to: "0x7",
        chainId: SupportedChainIds.POLYGON,
        data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xaf68b302",
        deviceModelId: DeviceModelId.FLEX,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(getTransactionDescriptorsMock).toHaveBeenCalledWith({
        deviceModelId: transaction.deviceModelId,
        address: "0xFirstAddress", // Should use the first address
        chainId: transaction.chainId,
        selector: transaction.selector,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.PROXY_DELEGATE_CALL,
          payload: "0x",
        },
        {
          type: ClearSignContextType.TRANSACTION_INFO,
          payload: "transaction-info",
        },
      ]);
    });

    it("should work with different supported device models", async () => {
      // GIVEN
      getProxyDelegateCallMock.mockResolvedValue(
        Right({
          delegateAddresses: ["0xResolvedAddress"],
          signedDescriptor: "0x1234567890abcdef",
        }),
      );
      getTransactionDescriptorsMock.mockResolvedValue(
        Right([
          {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "flex-transaction",
          },
        ]),
      );
      const transaction = {
        to: "0x7",
        chainId: SupportedChainIds.OPTIMISM,
        data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
        selector: "0xaf68b302",
        deviceModelId: DeviceModelId.FLEX,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(getTransactionDescriptorsMock).toHaveBeenCalledWith({
        deviceModelId: DeviceModelId.FLEX,
        address: "0xResolvedAddress",
        chainId: SupportedChainIds.OPTIMISM,
        selector: "0xaf68b302",
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.PROXY_DELEGATE_CALL,
          payload: "0x",
        },
        {
          type: ClearSignContextType.TRANSACTION_INFO,
          payload: "flex-transaction",
        },
      ]);
    });
  });
});
