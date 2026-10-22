import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type Eip712V2DescriptorDataSource } from "@/modules/ethereum/typed-data-v2/data/Eip712V2DescriptorDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import {
  type Eip712V2ContextInput,
  Eip712V2ContextLoader,
} from "./Eip712V2ContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("Eip712V2ContextLoader", () => {
  const dataSource = { getDescriptors: vi.fn() };
  const loader = new Eip712V2ContextLoader(
    dataSource as unknown as Eip712V2DescriptorDataSource,
    mockLoggerFactory,
  );

  const input: Eip712V2ContextInput = {
    verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
    chainId: 1,
    primaryTypeHash: `0x${"ab".repeat(32)}`,
    deviceModelId: DeviceModelId.FLEX,
  };
  const expectedTypes = [
    ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
    ClearSignContextType.ETHEREUM_EIP712_FIELD_DESCRIPTION,
    ClearSignContextType.ETHEREUM_ENUM,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("canHandle", () => {
    it("should handle a typed message asking for its V2 descriptors", () => {
      expect(loader.canHandle(input, expectedTypes)).toBe(true);
    });

    it("should not handle a request for other contexts", () => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
          ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
        ]),
      ).toBe(false);
    });

    it.each([
      ["a Nano S", { deviceModelId: DeviceModelId.NANO_S }],
      ["no primary type hash", { primaryTypeHash: undefined }],
      ["a contract that is not hexadecimal", { verifyingContract: "permit2" }],
      ["a chain that is not a number", { chainId: "1" }],
    ])("should not handle %s", (_, overrides) => {
      expect(loader.canHandle({ ...input, ...overrides }, expectedTypes)).toBe(
        false,
      );
    });
  });

  describe("load", () => {
    it("should return the contexts of the data source", async () => {
      const contexts = [
        {
          type: ClearSignContextType.ETHEREUM_EIP712_MESSAGE_INFO,
          payload: "0x01",
        },
      ];
      dataSource.getDescriptors.mockResolvedValue(Right(contexts));

      const result = await loader.load(input);

      expect(dataSource.getDescriptors).toHaveBeenCalledWith(input);
      expect(result).toStrictEqual(contexts);
    });

    it("should return an error context when the data source fails", async () => {
      const error = new Error("no descriptor");
      dataSource.getDescriptors.mockResolvedValue(Left(error));

      const result = await loader.load(input);

      expect(result).toStrictEqual([
        { type: ClearSignContextType.ERROR, error },
      ]);
    });
  });
});
