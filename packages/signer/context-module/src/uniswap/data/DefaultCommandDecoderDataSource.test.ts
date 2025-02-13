import { type HexaString } from "@ledgerhq/device-management-kit";

import {
  UNISWAP_COMMANDS,
  UniswapSupportedCommand,
} from "@/uniswap/constants/uniswap";
import {
  WETH_ADDRESS_BY_CHAIN_ID,
  WETHSupportedChainIds,
} from "@/uniswap/constants/weth";

import { type AbiDecoderDataSource } from "./AbiDecoderDataSource";
import { DefaultCommandDecoderDataSource } from "./DefaultCommandDecoderDataSource";
import { EthersAbiDecoderDataSource } from "./EthersAbiDecoderDataSource";

describe("DefaultCommandDecoderDataSource", () => {
  const apiDecoderMock: AbiDecoderDataSource = {
    decode: vi.fn(),
  };
  let dataSource: DefaultCommandDecoderDataSource;

  describe("decode with mocked apiDecoder", () => {
    beforeEach(() => {
      dataSource = new DefaultCommandDecoderDataSource(apiDecoderMock);
    });

    describe.each([
      [UniswapSupportedCommand.V2_SWAP_EXACT_IN],
      [UniswapSupportedCommand.V2_SWAP_EXACT_OUT],
    ])("%s", (command) => {
      it("should return the correct command data", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          ["0x0102030405060708090a0b0c0d0e0f1011121314"],
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual(["0x0102030405060708090a0b0c0d0e0f1011121314"]);
      });

      it("should return the correct command data with multiple addresses", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          [
            "0x0102030405060708090a0b0c0d0e0f1011121314",
            "0x0102030405060708090a0b0c0d0e0f1011121315",
          ],
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([
          "0x0102030405060708090a0b0c0d0e0f1011121314",
          "0x0102030405060708090a0b0c0d0e0f1011121315",
        ]);
      });

      it("should return an empty array if an address is not valid", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          ["0x0102030405060708090a0b0c0d0e0f1011121314", "invalid"],
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([]);
      });

      it("should return an empty array if the addresses are not an array", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          "invalid",
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([]);
      });

      it("should return an empty array if the addresses are not an array of hexa strings", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          ["invalid"],
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([]);
      });
    });
    describe.each([
      [UniswapSupportedCommand.V3_SWAP_EXACT_IN],
      [UniswapSupportedCommand.V3_SWAP_EXACT_OUT],
    ])("%s", (command) => {
      it("should return the correct command data", () => {
        // GIVEN
        const input: HexaString = "0x";
        const addresses = [
          "0102030405060708090a0b0c0d0e0f1011121314",
          "0102030405060708090a0b0c0d0e0f1011121315",
        ];
        const path = addresses.reduce(
          (acc, address) =>
            acc.length === 0 ? `0x${address}` : `${acc}999999${address}`,
          "",
        );
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          path,
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([
          "0x0102030405060708090a0b0c0d0e0f1011121314",
          "0x0102030405060708090a0b0c0d0e0f1011121315",
        ]);
      });

      it("should return the correct command data with multiple addresses", () => {
        // GIVEN
        const input: HexaString = "0x";
        const addresses = [
          "0102030405060708090a0b0c0d0e0f1011121314",
          "0102030405060708090a0b0c0d0e0f1011121315",
          "0102030405060708090a0b0c0d0e0f1011121316",
          "0102030405060708090a0b0c0d0e0f1011121317",
        ];
        const path = addresses.reduce(
          (acc, address) =>
            acc.length === 0 ? `0x${address}` : `${acc}999999${address}`,
          "",
        );
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          path,
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([
          "0x0102030405060708090a0b0c0d0e0f1011121314",
          "0x0102030405060708090a0b0c0d0e0f1011121315",
          "0x0102030405060708090a0b0c0d0e0f1011121316",
          "0x0102030405060708090a0b0c0d0e0f1011121317",
        ]);
      });

      it("should return an empty array if the path is not valid", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          "invalid",
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([]);
      });

      it("should return an empty array if the path is not a string", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          123,
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([]);
      });

      it("should return an empty array if the path is not a hexa string", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          "invalid",
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([]);
      });

      it("should return an empty array if the path is too short", () => {
        // GIVEN
        const input: HexaString = "0x";

        const addresses = [
          "0102030405060708090a0b0c0d0e0f1011121314",
          "0102030405060708090a0b0c0d0e0f101112131", // 1 char missing
        ];
        const path = addresses.reduce(
          (acc, address) =>
            acc.length === 0 ? `0x${address}` : `${acc}999999${address}`,
          "",
        );
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x",
          "0x",
          "0x",
          path,
          false,
        ]);

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([]);
      });
    });

    describe.each([
      UniswapSupportedCommand.WRAP_ETH,
      UniswapSupportedCommand.UNWRAP_ETH,
    ])("%s", (command) => {
      it.each([
        WETHSupportedChainIds.ARBITRUM_GOERLI,
        WETHSupportedChainIds.ARBITRUM_ONE,
        WETHSupportedChainIds.AVALANCHE_C_CHAIN,
        WETHSupportedChainIds.BASE,
        WETHSupportedChainIds.BASE_GOERLI,
        WETHSupportedChainIds.BLAST,
        WETHSupportedChainIds.BSC,
        WETHSupportedChainIds.ETHEREUM_GOERLI,
        WETHSupportedChainIds.ETHEREUM_MAINNET,
        WETHSupportedChainIds.ETHEREUM_SEPOLIA,
        WETHSupportedChainIds.OPTIMISM,
        WETHSupportedChainIds.OPTIMISM_GOERLI,
        WETHSupportedChainIds.POLYGON,
        WETHSupportedChainIds.POLYGON_MUMBAI,
      ])("should return the correct command data for chainId %s", (chainId) => {
        // GIVEN
        const input: HexaString = "0x";

        // WHEN
        const result = dataSource.decode(command, input, chainId);

        // THEN
        expect(result).toEqual([
          WETH_ADDRESS_BY_CHAIN_ID[chainId].toLowerCase(),
        ]);
      });

      it("should return an empty array if the chainId is not supported", () => {
        // GIVEN
        const input: HexaString = "0x";

        // WHEN
        const result = dataSource.decode(
          UniswapSupportedCommand.WRAP_ETH,
          input,
          123,
        );

        // THEN
        expect(result).toEqual([]);
      });
    });

    describe("SWEEP", () => {
      it("should return the correct command data", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "0x0102030405060708090a0b0c0d0e0f1011121314",
          "0x",
          "0x",
          "0x",
        ]);

        // WHEN
        const result = dataSource.decode(
          UniswapSupportedCommand.SWEEP,
          input,
          1,
        );

        // THEN
        expect(result).toEqual(["0x0102030405060708090a0b0c0d0e0f1011121314"]);
      });

      it("should return an empty array if the address is not valid", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          "invalid",
          "0x",
          "0x",
          "0x",
        ]);

        // WHEN
        const result = dataSource.decode(
          UniswapSupportedCommand.SWEEP,
          input,
          1,
        );

        // THEN
        expect(result).toEqual([]);
      });

      it("should return an empty array if the address is not a hexa string", () => {
        // GIVEN
        const input: HexaString = "0x";
        vi.spyOn(apiDecoderMock, "decode").mockReturnValueOnce([
          123,
          "0x",
          "0x",
          "0x",
        ]);

        // WHEN
        const result = dataSource.decode(
          UniswapSupportedCommand.SWEEP,
          input,
          1,
        );

        // THEN
        expect(result).toEqual([]);
      });
    });

    describe.each([
      UniswapSupportedCommand.PERMIT2_PERMIT,
      UniswapSupportedCommand.PERMIT2_TRANSFER_FROM,
      UniswapSupportedCommand.PERMIT2_PERMIT_BATCH,
      UniswapSupportedCommand.PERMIT2_TRANSFER_FROM_BATCH,
      UniswapSupportedCommand.PAY_PORTION,
      "invalid" as UniswapSupportedCommand,
    ])("%s", (command) => {
      it("should return an empty array", () => {
        // GIVEN
        const input: HexaString = "0x";

        // WHEN
        const result = dataSource.decode(command, input, 1);

        // THEN
        expect(result).toEqual([]);
      });
    });
  });

  describe("decode with real apiDecoder", () => {
    beforeEach(() => {
      const abiDecoder = new EthersAbiDecoderDataSource();
      dataSource = new DefaultCommandDecoderDataSource(abiDecoder);
    });

    describe("V3_SWAP_EXACT_IN -> PAY_PORTION -> UNWRAP_ETH", () => {
      // https://etherscan.io/tx/0xc9821c32c1782d9ab6baf6f9ca4b2565bce11aaf5146a2d303215bda026f5e48
      const commands: HexaString[] = ["0x00", "0x06", "0x0c"];
      const inputs: HexaString[] = [
        "0x00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000a18f07d736b90be5500000000000000000000000000000000000000000000000000000000b0b8122abd8412900000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002bb9f599ce614feb2e1bbe58f180f370d05b39344e002710c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000",
        "0x000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000017cc6042605381c158d2adab487434bde79aa61c000000000000000000000000000000000000000000000000000000000000005b",
        "0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000b0b8122abd84129",
      ];

      it("V3_SWAP_EXACT_IN", () => {
        // GIVEN
        const command = commands[0]!;
        const input = inputs[0]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual([
          "0xb9f599ce614feb2e1bbe58f180f370d05b39344e", // ERC20
          "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        ]);
      });

      it("PAY_PORTION", () => {
        // GIVEN
        const command = commands[1]!;
        const input = inputs[1]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual([]);
      });

      it("UNWRAP_ETH", () => {
        // GIVEN
        const command = commands[2]!;
        const input = inputs[2]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual(["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]); // WETH
      });
    });

    describe("WRAP_ETH -> V3_SWAP_EXACT_OUT -> TRANSFERT -> SWEEP -> UNWRAP_ETH", () => {
      // https://etherscan.io/tx/0xa628c8b3da2ad984aed0354d8ca4b4c3c42941491dc4e0d6a5f423fd65e6c90a
      const commands: HexaString[] = ["0x0b", "0x01", "0x05", "0x04", "0x0c"];
      const inputs: HexaString[] = [
        "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000078e6708e70aed0f",
        "0x00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000059a16770000000000000000000000000000000000000000000000000078e6708e70aed0f00000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002ba0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000000000000000",
        "0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000027213e28d7fda5c57fe9e5dd923818dbccf71c470000000000000000000000000000000000000000000000000000000000393870",
        "0x000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000006f939b43d65be049b7533907db08e80ba6969f450000000000000000000000000000000000000000000000000000000059682f00",
        "0x0000000000000000000000006f939b43d65be049b7533907db08e80ba6969f450000000000000000000000000000000000000000000000000000000000000000",
      ];

      it("WRAP_ETH", () => {
        // GIVEN
        const command = commands[0]!;
        const input = inputs[0]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual(["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]); // WETH
      });

      it("V3_SWAP_EXACT_OUT", () => {
        // GIVEN
        const command = commands[1]!;
        const input = inputs[1]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual([
          "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
          "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        ]);
      });

      it("TRANSFERT", () => {
        // GIVEN
        const command = commands[2]!;
        const input = inputs[2]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual([]);
      });

      it("SWEEP", () => {
        // GIVEN
        const command = commands[3]!;
        const input = inputs[3]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual(["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]); // USDC
      });

      it("UNWRAP_ETH", () => {
        // GIVEN
        const command = commands[4]!;
        const input = inputs[4]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual(["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]); // WETH
      });
    });

    describe("V2_SWAP_EXACT_IN -> PAY_PORTION -> UNWRAP_ETH", () => {
      // https://etherscan.io/tx/0x78bc5732213e09d9ead8cabc269b7c426b0301dfe543c37d0a920e25eaa9447f
      const commands: HexaString[] = ["0x08", "0x06", "0x0c"];
      const inputs: HexaString[] = [
        "0x0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000003ebb8addda849d38caed0000000000000000000000000000000000000000000000000f238e04a7ccbf5100000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000003b991130eae3cca364406d718da22fa1c3e7c256000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        "0x000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000000000fee13a103a10d593b9ae06b3e05f2e7e1c0000000000000000000000000000000000000000000000000000000000000019",
        "0x00000000000000000000000002573c689ddedddd450e6c947f5bb67de70e80b50000000000000000000000000000000000000000000000000f19dda9c38a50c1",
      ];

      it("V2_SWAP_EXACT_IN", () => {
        // GIVEN
        const command = commands[0]!;
        const input = inputs[0]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual([
          "0x3b991130eae3cca364406d718da22fa1c3e7c256", // ERC20
          "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", // WETH
        ]);
      });

      it("PAY_PORTION", () => {
        // GIVEN
        const command = commands[1]!;
        const input = inputs[1]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual([]);
      });

      it("UNWRAP_ETH", () => {
        // GIVEN
        const command = commands[2]!;
        const input = inputs[2]!;

        // WHEN
        const result = dataSource.decode(
          UNISWAP_COMMANDS[command] as UniswapSupportedCommand,
          input,
          1,
        );

        // THEN
        expect(result).toEqual(["0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"]); // WETH
      });
    });
  });
});
