import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import type { CalldataDescriptorDataSource } from "@/calldata/data/CalldataDescriptorDataSource";
import {
  type CalldataContextInput,
  CalldataContextLoader,
} from "@/calldata/domain/CalldataContextLoader";
import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { NullLoggerPublisherService } from "@/shared/utils/NullLoggerPublisherService";

describe("CalldataContextLoader", () => {
  const getProxyImplementationAddress = vi.fn();
  const getDappDescriptorsMock = vi.fn();
  const getTokenDescriptorsMock = vi.fn();
  const mockDappDataSource: CalldataDescriptorDataSource = {
    getCalldataDescriptors: getDappDescriptorsMock,
  };
  const mockTokenDataSource: CalldataDescriptorDataSource = {
    getCalldataDescriptors: getTokenDescriptorsMock,
  };
  const mockProxyDatasource: ProxyDataSource = {
    getProxyImplementationAddress: getProxyImplementationAddress,
  };
  const loader = new CalldataContextLoader(
    mockDappDataSource,
    mockTokenDataSource,
    mockProxyDatasource,
    NullLoggerPublisherService,
  );
  const SUPPORTED_TYPES: ClearSignContextType[] = [
    ClearSignContextType.TRANSACTION_INFO,
    ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
    ClearSignContextType.PROXY_INFO,
    ClearSignContextType.ENUM,
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("canHandle function", () => {
    const validInput: CalldataContextInput = {
      to: "0x1234567890123456789012345678901234567890",
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
      chainId: 1,
      deviceModelId: DeviceModelId.NANO_X,
    };

    it("should return true for valid input", () => {
      expect(loader.canHandle(validInput, SUPPORTED_TYPES)).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        false,
      );
      expect(loader.canHandle(validInput, [ClearSignContextType.NFT])).toBe(
        false,
      );
      expect(
        loader.canHandle(validInput, [ClearSignContextType.PROXY_INFO]),
      ).toBe(false);
      expect(loader.canHandle(validInput, [ClearSignContextType.ENUM])).toBe(
        false,
      );
      expect(
        loader.canHandle(validInput, [ClearSignContextType.TRANSACTION_INFO]),
      ).toBe(false);
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
      [123, "number input"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });

    it.each([
      [{ ...validInput, to: undefined }, "missing to"],
      [{ ...validInput, data: undefined }, "missing data"],
      [{ ...validInput, selector: undefined }, "missing selector"],
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, deviceModelId: undefined }, "missing deviceModelId"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });

    it.each([
      [{ ...validInput, to: "invalid-hex" }, "invalid to hex"],
      [{ ...validInput, to: "0x" }, "empty to hex"],
      [{ ...validInput, data: "invalid-hex" }, "invalid data hex"],
      [{ ...validInput, selector: "invalid-hex" }, "invalid selector hex"],
      [{ ...validInput, selector: "0x" }, "empty selector hex"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });

    it.each([
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
      [
        { ...validInput, deviceModelId: DeviceModelId.NANO_S },
        "deviceModelId is NANO_S",
      ],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });
  });

  it("should return an error if data source fails", async () => {
    // GIVEN
    getProxyImplementationAddress.mockResolvedValue(
      Left(new Error("data source error")),
    );
    getDappDescriptorsMock.mockResolvedValue(
      Left(new Error("data source error")),
    );
    const input = {
      to: "0x1234567890123456789012345678901234567890",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
      deviceModelId: DeviceModelId.NANO_X,
    } as CalldataContextInput;

    // WHEN
    const result = await loader.load(input);

    // THEN
    expect(getDappDescriptorsMock).toHaveBeenCalledWith({
      address: "0x1234567890123456789012345678901234567890",
      chainId: 3,
      selector: "0xaf68b302",
      deviceModelId: DeviceModelId.NANO_X,
    });
    expect(result).toEqual([
      {
        type: ClearSignContextType.ERROR,
        error: new Error(
          "[ContextModule] CalldataContextLoader: No calldata contexts found",
        ),
      },
    ]);
  });

  it("should return the contexts on success", async () => {
    // GIVEN
    getDappDescriptorsMock.mockResolvedValue(
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
    getProxyImplementationAddress.mockResolvedValue(
      Left(new Error("data source error")),
    );
    const input = {
      to: "0x1234567890123456789012345678901234567890",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
      deviceModelId: DeviceModelId.NANO_X,
    } as CalldataContextInput;

    // WHEN
    const result = await loader.load(input);

    // THEN
    expect(result).toEqual([
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

  it("should return the proxy delegate call context on success", async () => {
    // GIVEN
    getDappDescriptorsMock.mockResolvedValueOnce(Right([])); // No transaction descriptors found for the first call
    getDappDescriptorsMock.mockResolvedValue(
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
    getProxyImplementationAddress.mockResolvedValue(
      Right({
        implementationAddress: "0x1234567890abcdef",
        signedDescriptor: "0x1234567890abcdef",
      }),
    );
    const input = {
      to: "0x1234567890123456789012345678901234567890",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
      deviceModelId: DeviceModelId.NANO_X,
    } as CalldataContextInput;

    // WHEN
    const result = await loader.load(input);

    // THEN
    expect(result).toEqual([
      {
        type: ClearSignContextType.PROXY_INFO,
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

  it("should return an error when proxy delegate call succeeds but transaction descriptors for resolved address fail", async () => {
    // GIVEN
    getDappDescriptorsMock.mockResolvedValueOnce(Right([])); // No transaction descriptors found for the first call
    getDappDescriptorsMock.mockResolvedValueOnce(
      Left(new Error("data source error")),
    ); // Second call fails
    getProxyImplementationAddress.mockResolvedValue(
      Right({
        implementationAddress: "0xResolvedAddress",
        signedDescriptor: "0x1234567890abcdef",
      }),
    );
    const input = {
      to: "0x1234567890123456789012345678901234567890",
      chainId: 3,
      data: "0xaf68b302000000000000000000000000000000000000000000000000000000000002",
      selector: "0xaf68b302",
      deviceModelId: DeviceModelId.NANO_X,
    } as CalldataContextInput;

    // WHEN
    const result = await loader.load(input);

    // THEN
    expect(getDappDescriptorsMock).toHaveBeenCalledTimes(2);
    expect(getDappDescriptorsMock).toHaveBeenNthCalledWith(2, {
      address: "0xResolvedAddress",
      chainId: 3,
      selector: "0xaf68b302",
      deviceModelId: DeviceModelId.NANO_X,
    });
    expect(result).toEqual([
      {
        type: ClearSignContextType.ERROR,
        error: new Error(
          "[ContextModule] CalldataContextLoader: No calldata contexts found",
        ),
      },
    ]);
  });
});
