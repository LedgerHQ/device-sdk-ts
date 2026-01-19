import { Interface } from "ethers";
import { Left, Right } from "purify-ts";

import ABI from "@/external-plugin/__tests__/abi.json";
import { type ExternalPluginDataSource } from "@/external-plugin/data/ExternalPluginDataSource";
import {
  type ExternalPluginContextInput,
  ExternalPluginContextLoader,
} from "@/external-plugin/domain/ExternalPluginContextLoader";
import { type DappInfos } from "@/external-plugin/model/DappInfos";
import { type SelectorDetails } from "@/external-plugin/model/SelectorDetails";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { NullLoggerPublisherService } from "@/shared/utils/NullLoggerPublisherService";
import { type TokenDataSource } from "@/token/data/TokenDataSource";
import { type UniswapContextLoader } from "@/uniswap/domain/UniswapContextLoader";

const dappInfosBuilder = ({
  abi,
  selectorDetails,
}: {
  abi?: object[];
  selectorDetails?: Partial<SelectorDetails>;
}) => {
  return {
    abi: abi,
    selectorDetails: {
      erc20OfInterest: [],
      method: "",
      plugin: "",
      serializedData: "123456",
      signature: "7890",
      ...selectorDetails,
    },
  } as DappInfos;
};

const inputBuilder = (
  abi: object,
  functionName: string,
  params: unknown[],
): ExternalPluginContextInput => {
  const contract = new Interface(JSON.stringify(abi));
  const data = contract.encodeFunctionData(functionName, params);
  return {
    to: "0x0",
    data: data as `0x${string}`,
    selector: data.slice(0, 10) as `0x${string}`,
    chainId: 1,
  };
};

describe("ExternalPluginContextLoader", () => {
  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: vi.fn(),
  };
  const mockExternalPluginDataSource: ExternalPluginDataSource = {
    getDappInfos: vi.fn(),
  };
  const mockUniswapLoader: UniswapContextLoader = {
    canHandle: vi.fn(),
    load: vi.fn(),
  } as unknown as UniswapContextLoader;
  const loader = new ExternalPluginContextLoader(
    mockExternalPluginDataSource,
    mockTokenDataSource,
    mockUniswapLoader,
    NullLoggerPublisherService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockImplementation(
      ({ address }) => Promise.resolve(Right(`payload-${address}`)),
    );
  });

  describe("canHandle function", () => {
    const validInput: ExternalPluginContextInput = {
      to: "0x1234567890123456789012345678901234567890",
      data: "0x095ea7b30000000000000000000000001234567890123456789012345678901234567890",
      selector: "0x095ea7b3",
      chainId: 1,
    };

    it("should return true for valid input", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.EXTERNAL_PLUGIN,
          ClearSignContextType.TOKEN,
        ]),
      ).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.NFT])).toBe(
        false,
      );
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        false,
      );
      expect(
        loader.canHandle(validInput, [ClearSignContextType.EXTERNAL_PLUGIN]),
      ).toBe(false);
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
      [123, "number input"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.EXTERNAL_PLUGIN,
          ClearSignContextType.TOKEN,
        ]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, to: undefined }, "missing to"],
      [{ ...validInput, data: undefined }, "missing data"],
      [{ ...validInput, selector: undefined }, "missing selector"],
      [{ ...validInput, chainId: undefined }, "missing chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.EXTERNAL_PLUGIN,
          ClearSignContextType.TOKEN,
        ]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, to: "invalid-hex" }, "invalid to hex"],
      [{ ...validInput, to: "0x" }, "empty to hex"],
      [{ ...validInput, data: "invalid-hex" }, "invalid data hex"],
      [{ ...validInput, data: "0x" }, "empty data (0x)"],
      [{ ...validInput, selector: "invalid-hex" }, "invalid selector hex"],
      [{ ...validInput, selector: "0x" }, "empty selector hex"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.EXTERNAL_PLUGIN,
          ClearSignContextType.TOKEN,
        ]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
      [{ ...validInput, chainId: undefined }, "undefined chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.EXTERNAL_PLUGIN,
          ClearSignContextType.TOKEN,
        ]),
      ).toBe(false);
    });
  });

  describe("load function", () => {
    it("should return an empty array if no dapp info is provided", async () => {
      // GIVEN
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(undefined),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return e plugin if no erc20OfInterest is provided", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: [],
          method: "singleParam",
          plugin: "TestPlugin",
        },
      });
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(mockUniswapLoader.canHandle).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "1234567890",
        },
      ]);
    });

    it("should return a list of context responses when one erc20OfInterest is provided for a single parameter", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: ["fromToken"],
          method: "singleParam",
          plugin: "TestPlugin",
        },
      });
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(mockUniswapLoader.canHandle).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.arrayContaining([
          {
            type: ClearSignContextType.EXTERNAL_PLUGIN,
            payload: "1234567890",
          },
          {
            type: ClearSignContextType.TOKEN,
            payload: "payload-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          },
        ]),
      );
    });

    it("should return a context response with only set external plugin when one erc20OfInterest is provided for a single parameter but no payload is feched", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: ["fromToken"],
          method: "singleParam",
        },
      });
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(Error("error")),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(mockUniswapLoader.canHandle).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "1234567890",
        },
      ]);
    });

    it("should return a list of context responses when two erc20OfInterest are provided for two parameters", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: ["fromToken", "toToken"],
          method: "multipleParams",
        },
      });
      const input = inputBuilder(ABI, "multipleParams", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual(
        expect.arrayContaining([
          {
            type: ClearSignContextType.EXTERNAL_PLUGIN,
            payload: "1234567890",
          },
          {
            type: ClearSignContextType.TOKEN,
            payload: "payload-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          },
          {
            type: ClearSignContextType.TOKEN,
            payload: "payload-0xdAC17F958D2ee523a2206206994597C13D831ec7",
          },
        ]),
      );
    });

    it("should return a list of context responses when one erc20OfInterest is an array", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: [
            "fromToken.0",
            "fromToken.1",
            "fromToken.2",
            "fromToken.-1",
          ],
          method: "arrayParam",
        },
      });
      const input = inputBuilder(ABI, "arrayParam", [
        [
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          "0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
        ],
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xdAC17F958D2ee523a2206206994597C13D831ec7",
        },
        // fromToken.2
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
        },
        // fromToken.-1
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
        },
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "1234567890",
        },
      ]);
    });

    it("should return an error when a token datasource returns an error", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: ["fromToken"],
          method: "singleParam",
        },
      });
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(new Error("error")),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "1234567890",
        },
      ]);
    });

    it("should return an error when the abi is not conform", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: [{ fakeabi: "notworking" }],
        selectorDetails: {
          erc20OfInterest: ["fromToken"],
          method: "singleParam",
        },
      });
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] ExternalPluginContextLoader: Unable to parse abi",
          ),
        },
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "1234567890",
        },
      ]);
    });

    it("should throw an error when the erc20OfInterest doest not exist in the transaction", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: ["notFound"],
          method: "singleParam",
        },
      });
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] ExternalPluginContextLoader: Unable to get address",
          ),
        },
      ]);
    });

    it("should throw an error when an out-of-bounds element is present in erc20OfInterest", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: ["fromToken.3"],
          method: "arrayParam",
        },
      });
      const input = inputBuilder(ABI, "arrayParam", [
        [
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          "0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
        ],
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new RangeError("out of result range"),
        },
      ]);
    });

    it("should return a list of context responses when one erc20OfInterest is a complex struct", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: [
            "complexStruct.address1",
            "complexStruct.param1.param2.0.param3.addresses.0",
            "complexStruct.param1.param2.0.param3.addresses.1",
            "complexStruct.param1.param2.0.param3.addresses.-1",
            "complexStruct.param1.param2.1.param3.addresses.0",
            "complexStruct.param1.param2.-1.param3.addresses.0",
          ],
          method: "complexStructParam",
        },
      });
      const input = inputBuilder(ABI, "complexStructParam", [
        {
          address1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          param1: {
            param2: [
              {
                param3: {
                  addresses: [
                    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
                    "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
                  ],
                },
              },
              {
                param3: {
                  addresses: ["0xB8c77482e45F1F44dE1745F52C74426C631bDD52"],
                },
              },
            ],
          },
        },
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xdAC17F958D2ee523a2206206994597C13D831ec7",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
        },
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "1234567890",
        },
      ]);
    });

    it("should return a plugin with Uniswap not being able to load token", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: [],
          method: "singleParam",
          plugin: "Uniswap",
        },
      });
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );
      vi.spyOn(mockUniswapLoader, "canHandle").mockReturnValueOnce(false);

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(mockUniswapLoader.canHandle).toHaveBeenCalled();
      expect(mockUniswapLoader.load).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "1234567890",
        },
      ]);
    });

    it("should return a plugin with Uniswap extracted tokens", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: [],
          method: "singleParam",
          plugin: "Uniswap",
        },
      });
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );
      vi.spyOn(mockUniswapLoader, "canHandle").mockReturnValueOnce(true);
      vi.spyOn(mockUniswapLoader, "load").mockResolvedValue([
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
        },
      ]);

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(mockUniswapLoader.canHandle).toHaveBeenCalled();
      expect(mockUniswapLoader.load).toHaveBeenCalled();
      expect(result).toEqual([
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "1234567890",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "payload-0xB8c77482e45F1F44dE1745F52C74426C631bDD52",
        },
      ]);
    });

    it("should return an error when datasource return a Left", async () => {
      // GIVEN
      const input = inputBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Left(new Error("error")),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
      ]);
    });
  });
});
