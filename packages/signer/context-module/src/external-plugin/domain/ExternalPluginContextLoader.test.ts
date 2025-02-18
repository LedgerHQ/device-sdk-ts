import { Interface } from "ethers";
import { Left, Right } from "purify-ts";

import ABI from "@/external-plugin/__tests__/abi.json";
import { type ExternalPluginDataSource } from "@/external-plugin/data/ExternalPluginDataSource";
import { ExternalPluginContextLoader } from "@/external-plugin/domain/ExternalPluginContextLoader";
import { type DappInfos } from "@/external-plugin/model/DappInfos";
import { type SelectorDetails } from "@/external-plugin/model/SelectorDetails";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TransactionContext } from "@/shared/model/TransactionContext";
import { type TokenDataSource } from "@/token/data/TokenDataSource";

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

const transactionBuilder = (
  abi: object,
  functionName: string,
  params: unknown[],
): TransactionContext => {
  const contract = new Interface(JSON.stringify(abi));
  const data = contract.encodeFunctionData(functionName, params);
  return {
    to: "0x0",
    data,
  } as TransactionContext;
};

describe("ExternalPluginContextLoader", () => {
  const mockTokenDataSource: TokenDataSource = {
    getTokenInfosPayload: vi.fn(),
  };
  const mockExternalPluginDataSource: ExternalPluginDataSource = {
    getDappInfos: vi.fn(),
  };
  const loader = new ExternalPluginContextLoader(
    mockExternalPluginDataSource,
    mockTokenDataSource,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockImplementation(
      ({ address }) => Promise.resolve(Right(`payload-${address}`)),
    );
  });

  describe("load function", async () => {
    it("should return an empty array if no destination address is provided", async () => {
      // GIVEN
      const transaction = {} as TransactionContext;

      // WHEN
      const promise = () => loader.load(transaction);

      // THEN
      await expect(promise()).resolves.toEqual([]);
    });

    it("should return an empty array if data is undefined", async () => {
      // GIVEN
      const transaction = { to: "0x0" } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return an empty array if no data provided", async () => {
      // GIVEN
      const transaction = { to: "0x0", data: "0x" } as TransactionContext;

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return an empty array if no dapp info is povided", async () => {
      // GIVEN
      const transaction = transactionBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(undefined),
      );

      // WHEN
      const result = await loader.load(transaction);

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
        },
      });
      const transaction = transactionBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(transaction);

      // THEN
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
        },
      });
      const transaction = transactionBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(transaction);

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
      const transaction = transactionBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(Error("error")),
      );

      // WHEN
      const result = await loader.load(transaction);

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

    it("should return a list of context responses when two erc20OfInterest are provided for two parameters", async () => {
      // GIVEN
      const dappInfos = dappInfosBuilder({
        abi: ABI,
        selectorDetails: {
          erc20OfInterest: ["fromToken", "toToken"],
          method: "multipleParams",
        },
      });
      const transaction = transactionBuilder(ABI, "multipleParams", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(transaction);

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
      const transaction = transactionBuilder(ABI, "arrayParam", [
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
      const result = await loader.load(transaction);

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
      const transaction = transactionBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );
      vi.spyOn(mockTokenDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(new Error("error")),
      );

      // WHEN
      const result = await loader.load(transaction);

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
      const transaction = transactionBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(transaction);

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
      const transaction = transactionBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Right(dappInfos),
      );

      // WHEN
      const result = await loader.load(transaction);

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
      const transaction = transactionBuilder(ABI, "arrayParam", [
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
      const result = await loader.load(transaction);

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
      const transaction = transactionBuilder(ABI, "complexStructParam", [
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
      const result = await loader.load(transaction);

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

    it("should return an error when datasource return a Left", async () => {
      // GIVEN
      const transaction = transactionBuilder(ABI, "singleParam", [
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      ]);
      vi.spyOn(mockExternalPluginDataSource, "getDappInfos").mockResolvedValue(
        Left(new Error("error")),
      );

      // WHEN
      const result = await loader.load(transaction);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
      ]);
    });

    it("should return an error when transaction data is not a valid hex string", async () => {
      // GIVEN
      const transaction = {
        to: "0x0",
        data: "notAHexString",
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
    });
  });
});
