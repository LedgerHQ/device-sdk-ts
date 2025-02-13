import { Interface, type TransactionDescription } from "ethers";
import { Left, Right } from "purify-ts";

import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TransactionContext } from "@/shared/model/TransactionContext";
import { type HttpTokenDataSource } from "@/token/data/HttpTokenDataSource";
import {
  UNISWAP_EXECUTE_SELECTOR,
  UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
  UniswapSupportedCommand,
} from "@/uniswap/constants/uniswap";
import { type CommandDecoderDataSource } from "@/uniswap/data/CommandDecoderDataSource";
import { DefaultCommandDecoderDataSource } from "@/uniswap/data/DefaultCommandDecoderDataSource";
import { EthersAbiDecoderDataSource } from "@/uniswap/data/EthersAbiDecoderDataSource";

import { UniswapContextLoader } from "./UniswapContextLoader";

describe("UniswapContextLoader", () => {
  const commandDecoderMock: CommandDecoderDataSource = {
    decode: vi.fn(),
  };
  const tokenDataSourceMock = {
    getTokenInfosPayload: vi.fn(),
  };
  let loader: UniswapContextLoader;

  describe("load", () => {
    describe("with tokenDataSourceMock", () => {
      beforeEach(() => {
        vi.spyOn(
          tokenDataSourceMock,
          "getTokenInfosPayload",
        ).mockImplementation(({ address }) =>
          Promise.resolve(Right(`payload-${address}`)),
        );
        loader = new UniswapContextLoader(
          new DefaultCommandDecoderDataSource(new EthersAbiDecoderDataSource()),
          tokenDataSourceMock as unknown as HttpTokenDataSource,
        );
      });

      it("should return the external plugin context and the decoded contexts", async () => {
        // GIVEN
        // https://etherscan.io/getRawTx?tx=0xc9821c32c1782d9ab6baf6f9ca4b2565bce11aaf5146a2d303215bda026f5e48
        const transactionContext = {
          chainId: 1,
          data: "0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000067a4855b000000000000000000000000000000000000000000000000000000000000000300060c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000a18f07d736b90be5500000000000000000000000000000000000000000000000000000000b0b8122abd8412900000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002bb9f599ce614feb2e1bbe58f180f370d05b39344e002710c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000017cc6042605381c158d2adab487434bde79aa61c000000000000000000000000000000000000000000000000000000000000005b000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000b0b8122abd84129c001a053efc49d03b694742500f49aa09df2360bd7e297fa730c745e0d4320b42fc33fa01ca1c85a46c561f624830fffbae2441ba0f2d54eb5b0f17e0e3561d10db0b7ee",
        } as TransactionContext;

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(result).toEqual([
          {
            type: ClearSignContextType.EXTERNAL_PLUGIN,
            payload:
              "07556e69737761703fc91a3afd70395cd496c647d5a6cc9d4b2b7fad3593564c3044022014391e8f355867a57fe88f6a5a4dbcb8bf8f888a9db3ff3449caf72d120396bd02200c13d9c3f79400fe0aa0434ac54d59b79503c9964a4abc3e8cd22763e0242935",
          },
          {
            type: "token",
            payload: "payload-0xb9f599ce614feb2e1bbe58f180f370d05b39344e",
          }, // ERC20
          {
            type: "token",
            payload: "payload-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          }, // WETH
        ]);
      });

      it("should return the external plugin context and the decoded contexts with a permit", async () => {
        // GIVEN
        // https://etherscan.io/getRawTx?tx=0xc4df7ccc0527541d0e80856a8f38deedc48c84825e9355469ba02d873502ce2f
        // PERMIT2_PERMIT, V3_SWAP_EXACT_OUT, UNWRAP_ETH
        const transactionContext = {
          chainId: 1,
          data: "0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000669b9ec100000000000000000000000000000000000000000000000000000000000000030a010c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001e00000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000016000000000000000000000000055747be9f9f5beb232ad59fe7af013b81d95fd5e000000000000000000000000ffffffffffffffffffffffffffffffffffffffff0000000000000000000000000000000000000000000000000000000066c32b0d0000000000000000000000000000000000000000000000000000000000000008000000000000000000000000ef1c6e67703c7bd7107eed8303fbe6ec2554bf6b00000000000000000000000000000000000000000000000000000000669b9ec100000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000410d756f55acf289e9754faf91bba0a704b5c7c0aa4b1dfd551115ccbe4c7f290234e1a14265e1da0bc872a23627d997fe37a689c290d519f7b8c9bdde1b79108e1b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000030ba49cbff5a00000000000000000000000000000000000000000000000089677c957272141800000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002bc02aaa39b223fe8d0a0e5c4f27ead9083c756cc200271055747be9f9f5beb232ad59fe7af013b81d95fd5e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000030ba49cbff5a000c001a0e406d9c91c8b46d959fcd31a28518a77bb248ebb316c5fab7b98335cce922f2aa0462cb970c32a8dbfe71c57b888c43b9ed04fce41d169dbfcc745445587adb771",
        } as TransactionContext;

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(result).toEqual([
          {
            type: ClearSignContextType.EXTERNAL_PLUGIN,
            payload:
              "07556e69737761703fc91a3afd70395cd496c647d5a6cc9d4b2b7fad3593564c3044022014391e8f355867a57fe88f6a5a4dbcb8bf8f888a9db3ff3449caf72d120396bd02200c13d9c3f79400fe0aa0434ac54d59b79503c9964a4abc3e8cd22763e0242935",
          },
          {
            type: "token",
            payload: "payload-0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          }, // WETH
          {
            type: "token",
            payload: "payload-0x55747be9f9f5beb232ad59fe7af013b81d95fd5e",
          }, // ERC20
        ]);
      });

      it("should return an empty array if the transaction is not supported", async () => {
        // GIVEN
        const transactionContext = {} as TransactionContext;
        vi.spyOn(commandDecoderMock, "decode").mockReturnValue([]);

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(result).toEqual([]);
      });

      it("should return an empty array if a command is not supported", async () => {
        // GIVEN
        // https://etherscan.io/getRawTx?tx=0xa628c8b3da2ad984aed0354d8ca4b4c3c42941491dc4e0d6a5f423fd65e6c90a
        // The command 0x05 (TRANSFER) is not supported
        const transactionContext = {
          chainId: 1,
          data: "0x3593564c000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000067a4bef600000000000000000000000000000000000000000000000000000000000000050b0105040c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000022000000000000000000000000000000000000000000000000000000000000002a0000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000078e6708e70aed0f000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000059a16770000000000000000000000000000000000000000000000000078e6708e70aed0f00000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002ba0b86991c6218b36c1d19d4a2e9eb0ce3606eb480001f4c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800000000000000000000000027213e28d7fda5c57fe9e5dd923818dbccf71c4700000000000000000000000000000000000000000000000000000000003938700000000000000000000000000000000000000000000000000000000000000060000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000006f939b43d65be049b7533907db08e80ba6969f450000000000000000000000000000000000000000000000000000000059682f0000000000000000000000000000000000000000000000000000000000000000400000000000000000000000006f939b43d65be049b7533907db08e80ba6969f4500000000000000000000000000000000000000000000000000000000000000000cc080a07c86dd5813ec1f3725c402f8bea6105546d1093c59676023b971f1d83f61bd4ea02a353bf3028cabcbe68c5dc8906752bafe55afc86b6344edb3ffd8a3650332e8",
        } as TransactionContext;

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(result).toEqual([]);
      });
    });

    describe("with mocked ethers parseTransaction", () => {
      beforeEach(() => {
        vi.resetAllMocks();
        loader = new UniswapContextLoader(
          commandDecoderMock,
          tokenDataSourceMock as unknown as HttpTokenDataSource,
        );
      });

      it("should return an array with contexts if 2 chain swaps are supported", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
          chainId: 0x42,
        } as TransactionContext;
        const commands = `0x0809`; // V2_SWAP_EXACT_IN, V2_SWAP_EXACT_OUT
        vi.spyOn(Interface.prototype, "parseTransaction").mockReturnValue({
          args: [commands, ["0x0001", "0x0002"]],
        } as TransactionDescription);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce([
          "0x01",
          "0x04",
          "0x02",
        ]);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce([
          "0x02",
          "0x03",
        ]);
        vi.spyOn(
          tokenDataSourceMock,
          "getTokenInfosPayload",
        ).mockImplementation(({ address }) =>
          Promise.resolve(Right(`payload-${address}`)),
        );

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          1,
          UniswapSupportedCommand.V2_SWAP_EXACT_IN,
          "0x0001",
          0x42,
        );
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          2,
          UniswapSupportedCommand.V2_SWAP_EXACT_OUT,
          "0x0002",
          0x42,
        );
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(1, { address: "0x01", chainId: 0x42 });
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(2, { address: "0x04", chainId: 0x42 });
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(3, { address: "0x02", chainId: 0x42 });
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(4, { address: "0x03", chainId: 0x42 });
        expect(result).toEqual([
          {
            type: ClearSignContextType.EXTERNAL_PLUGIN,
            payload:
              "07556e69737761703fc91a3afd70395cd496c647d5a6cc9d4b2b7fad3593564c3044022014391e8f355867a57fe88f6a5a4dbcb8bf8f888a9db3ff3449caf72d120396bd02200c13d9c3f79400fe0aa0434ac54d59b79503c9964a4abc3e8cd22763e0242935",
          },
          {
            type: "token",
            payload: "payload-0x01",
          },
          {
            type: "token",
            payload: "payload-0x04",
          },
          {
            type: "token",
            payload: "payload-0x02",
          },
          {
            type: "token",
            payload: "payload-0x03",
          },
        ]);
      });

      it("should return an array with contexts if 1 chain swap with a non swap command", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
          chainId: 0x42,
        } as TransactionContext;
        const commands = `0x0b0004`; // WRAP_ETH, V3_SWAP_EXACT_IN, SWEEP
        vi.spyOn(Interface.prototype, "parseTransaction").mockReturnValue({
          args: [commands, ["0x0001", "0x0002", "0x0003"]],
        } as TransactionDescription);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce(["0x01"]);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce([
          "0x02",
          "0x03",
        ]);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce(["0x04"]);
        vi.spyOn(
          tokenDataSourceMock,
          "getTokenInfosPayload",
        ).mockImplementation(({ address }) =>
          Promise.resolve(Right(`payload-${address}`)),
        );

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          1,
          UniswapSupportedCommand.WRAP_ETH,
          "0x0001",
          0x42,
        );
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(1, { address: "0x01", chainId: 0x42 });
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(2, { address: "0x02", chainId: 0x42 });
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(3, { address: "0x03", chainId: 0x42 });
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(4, { address: "0x04", chainId: 0x42 });
        expect(result).toEqual([
          {
            type: ClearSignContextType.EXTERNAL_PLUGIN,
            payload:
              "07556e69737761703fc91a3afd70395cd496c647d5a6cc9d4b2b7fad3593564c3044022014391e8f355867a57fe88f6a5a4dbcb8bf8f888a9db3ff3449caf72d120396bd02200c13d9c3f79400fe0aa0434ac54d59b79503c9964a4abc3e8cd22763e0242935",
          },
          {
            type: "token",
            payload: "payload-0x01",
          },
          {
            type: "token",
            payload: "payload-0x02",
          },
          {
            type: "token",
            payload: "payload-0x03",
          },
          {
            type: "token",
            payload: "payload-0x04",
          },
        ]);
      });

      it("should return an array with contexts if one token is not found", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
          chainId: 0x42,
        } as TransactionContext;
        const commands = `0x0809`; // V2_SWAP_EXACT_IN, V2_SWAP_EXACT_OUT
        vi.spyOn(Interface.prototype, "parseTransaction").mockReturnValue({
          args: [commands, ["0x0001", "0x0002"]],
        } as TransactionDescription);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce([
          "0x01",
          "0x02",
        ]);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce([
          "0x02",
          "0x03",
        ]);
        vi.spyOn(
          tokenDataSourceMock,
          "getTokenInfosPayload",
        ).mockResolvedValueOnce(Left("error"));
        vi.spyOn(
          tokenDataSourceMock,
          "getTokenInfosPayload",
        ).mockImplementation(({ address }) =>
          Promise.resolve(Right(`payload-${address}`)),
        );

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          1,
          UniswapSupportedCommand.V2_SWAP_EXACT_IN,
          "0x0001",
          0x42,
        );
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          2,
          UniswapSupportedCommand.V2_SWAP_EXACT_OUT,
          "0x0002",
          0x42,
        );
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(1, { address: "0x01", chainId: 0x42 });
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(2, { address: "0x02", chainId: 0x42 });
        expect(
          tokenDataSourceMock.getTokenInfosPayload,
        ).toHaveBeenNthCalledWith(3, { address: "0x03", chainId: 0x42 });
        expect(result).toEqual([
          {
            type: ClearSignContextType.EXTERNAL_PLUGIN,
            payload:
              "07556e69737761703fc91a3afd70395cd496c647d5a6cc9d4b2b7fad3593564c3044022014391e8f355867a57fe88f6a5a4dbcb8bf8f888a9db3ff3449caf72d120396bd02200c13d9c3f79400fe0aa0434ac54d59b79503c9964a4abc3e8cd22763e0242935",
          },
          {
            type: "error",
            error: "error",
          },
          {
            type: "token",
            payload: "payload-0x02",
          },
          {
            type: "token",
            payload: "payload-0x03",
          },
        ]);
      });

      it("should return an empty array if the if 2 chain swaps are not supported", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
          chainId: 0x42,
        } as TransactionContext;
        const commands = `0x0809`; // V2_SWAP_EXACT_IN, V2_SWAP_EXACT_OUT
        vi.spyOn(Interface.prototype, "parseTransaction").mockReturnValue({
          args: [commands, ["0x0001", "0x0002"]],
        } as TransactionDescription);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce([
          "0x01",
          "0x02",
        ]);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValueOnce([
          "0x03", // should be 0x02
          "0x04",
        ]);

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          1,
          UniswapSupportedCommand.V2_SWAP_EXACT_IN,
          "0x0001",
          0x42,
        );
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          2,
          UniswapSupportedCommand.V2_SWAP_EXACT_OUT,
          "0x0002",
          0x42,
        );
        expect(tokenDataSourceMock.getTokenInfosPayload).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it("should return an empty array if no command are returned from parseTransaction", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
        } as TransactionContext;
        vi.spyOn(Interface.prototype, "parseTransaction").mockReturnValue({
          args: [""],
        } as TransactionDescription);

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).not.toHaveBeenCalled();
        expect(tokenDataSourceMock.getTokenInfosPayload).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it("should return an empty array if no inputs are returned from parseTransaction", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
        } as TransactionContext;
        vi.spyOn(Interface.prototype, "parseTransaction").mockReturnValue({
          args: ["0x08", []],
        } as TransactionDescription);

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(tokenDataSourceMock.getTokenInfosPayload).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it("should return an empty array if parseTransaction throws an error", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
        } as TransactionContext;
        vi.spyOn(Interface.prototype, "parseTransaction").mockImplementation(
          () => {
            throw new Error();
          },
        );

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).not.toHaveBeenCalled();
        expect(tokenDataSourceMock.getTokenInfosPayload).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it("should return an empty array if the swap is with multiple pool versions", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
          chainId: 0x42,
        } as TransactionContext;
        const commands = `0x080900`; // V2_SWAP_EXACT_IN, V2_SWAP_EXACT_OUT, V3_SWAP_EXACT_IN
        vi.spyOn(Interface.prototype, "parseTransaction").mockReturnValue({
          args: [commands, ["0x00", "0x01", "0x02"]],
        } as TransactionDescription);
        vi.spyOn(commandDecoderMock, "decode").mockReturnValue([
          "0x01",
          "0x02",
        ]);

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          1,
          UniswapSupportedCommand.V2_SWAP_EXACT_IN,
          "0x00",
          0x42,
        );
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          2,
          UniswapSupportedCommand.V2_SWAP_EXACT_OUT,
          "0x01",
          0x42,
        );
        expect(commandDecoderMock.decode).toHaveBeenNthCalledWith(
          3,
          UniswapSupportedCommand.V3_SWAP_EXACT_IN,
          "0x02",
          0x42,
        );
        expect(tokenDataSourceMock.getTokenInfosPayload).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it("should return an empty array if the selector is not supported", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: "0x00000000",
          chainId: 0x42,
        } as TransactionContext;

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).not.toHaveBeenCalled();
        expect(tokenDataSourceMock.getTokenInfosPayload).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it("should return an empty array if the length of the commands and inputs are different", async () => {
        // GIVEN
        const transactionContext = {
          to: UNISWAP_UNIVERSAL_ROUTER_ADDRESS,
          data: UNISWAP_EXECUTE_SELECTOR,
          chainId: 0x42,
        } as TransactionContext;
        const commands = `0x0809`; // V2_SWAP_EXACT_IN, V2_SWAP_EXACT_OUT
        vi.spyOn(Interface.prototype, "parseTransaction").mockReturnValue({
          args: [commands, ["0x0001"]],
        } as TransactionDescription);

        // WHEN
        const result = await loader.load(transactionContext);

        // THEN
        expect(commandDecoderMock.decode).not.toHaveBeenCalled();
        expect(tokenDataSourceMock.getTokenInfosPayload).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });
    });
  });
});
