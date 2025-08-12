import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import type { ProxyDelegateCall } from "@/transaction/model/ProxyDelegateCall";
import type { ProxyImplementationAddress } from "@/transaction/model/ProxyImplementationAddress";
import PACKAGE from "@root/package.json";

import { type ProxyImplementationAddressDto } from "./dto/ProxyImplementationAddressDto";
import type {
  GetProxyDelegateCallParam,
  GetProxyImplementationAddressParam,
  ProxyDataSource,
} from "./HttpProxyDataSource";
import { HttpProxyDataSource } from "./HttpProxyDataSource";

vi.mock("axios");

describe("HttpProxyDataSource", () => {
  const config = {
    web3checks: {
      url: "web3checksUrl",
    },
    originToken: "originToken",
  } as ContextModuleConfig;

  let datasource: ProxyDataSource;
  const defaultParams: GetProxyDelegateCallParam = {
    proxyAddress: "0x72CBdEaAdddD14Ec95b92995933CeC69566650f0",
    calldata:
      "0x6a76120200000000000000000000000072cbdeaadddd14ec95b92995933cec69566650f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000440d582f13000000000000000000000000cfa7eae32032bf431aed95532142a9c2b35715d40000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041000000000000000000000000a0766b65a4f7b1da79a1af79ac695456efa2864400000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000",
    chainId: 1,
  };
  const defaultImplementAddressParams: GetProxyImplementationAddressParam = {
    proxyAddress: "0xee6a57ec80ea46401049e92587e52f5ec1c24785",
    chainId: 1,
  };
  const delegateProxyResponse: ProxyDelegateCall = {
    delegateAddresses: ["0xd9db270c1b5e3bd161e8c8503c55ceabee709552"],
    signedDescriptor: "0x1234567890abcdef",
  };
  const implementationAddressResponse: ProxyImplementationAddress = {
    implementationAddress: "0x91ae842a5ffd8d12023116943e72a606179294f3",
  };
  const implementationAddressDto: ProxyImplementationAddressDto = {
    implementationAddress: "0x91ae842a5ffd8d12023116943e72a606179294f3",
    proxyAddress: "0xee6a57ec80ea46401049e92587e52f5ec1c24785",
    standard: "proxy",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    datasource = new HttpProxyDataSource({
      metadataServiceDomain: {
        url: "https://nft.api.live.ledger.com",
      },
      originToken: "originToken",
    } as ContextModuleConfig);
  });

  describe("getDelegateProxy", () => {
    it("should call axios with the ledger client version header", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const requestSpy = vi.fn(() =>
        Promise.resolve({ data: delegateProxyResponse }),
      );
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getProxyDelegateCall(defaultParams);

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: version,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          },
        }),
      );
    });

    it("should return the delegate proxy response on success", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValue({
        data: delegateProxyResponse,
      });

      // WHEN
      const result = await datasource.getProxyDelegateCall(defaultParams);

      // THEN
      expect(result).toEqual(Right(delegateProxyResponse));
    });

    it("should return an error when axios throws an error", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockRejectedValue(new Error("fail"));

      // WHEN
      const result = await datasource.getProxyDelegateCall(defaultParams);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpProxyDataSource: Failed to fetch delegate proxy",
          ),
        ),
      );
    });

    it("should return an error if response shape is invalid", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValue({ data: { foo: "bar" } });

      // WHEN
      const result = await datasource.getProxyDelegateCall(defaultParams);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy 0x72CBdEaAdddD14Ec95b92995933CeC69566650f0 on chain 1",
          ),
        ),
      );
    });

    it("should use the provided chainId in the URL", async () => {
      // GIVEN
      const requestSpy = vi.fn(() =>
        Promise.resolve({ data: delegateProxyResponse }),
      );
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      const paramsWithDifferentChainId: GetProxyDelegateCallParam = {
        proxyAddress: "0x72CBdEaAdddD14Ec95b92995933CeC69566650f0",
        calldata:
          "0x6a76120200000000000000000000000072cbdeaadddd14ec95b92995933cec69566650f0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000440d582f13000000000000000000000000cfa7eae32032bf431aed95532142a9c2b35715d40000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041000000000000000000000000a0766b65a4f7b1da79a1af79ac695456efa2864400000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000",
        chainId: 137, // Polygon
      };

      // WHEN
      await datasource.getProxyDelegateCall(paramsWithDifferentChainId);

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "https://nft.api.live.ledger.com/v1/ethereum/137/contract/proxy/delegate",
        }),
      );
    });

    it("should return an error if no dto is returned from the api", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValue({
        data: undefined,
      });

      // WHEN
      const result = await datasource.getProxyDelegateCall(defaultParams);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpProxyDataSource: No data received for proxy 0x72CBdEaAdddD14Ec95b92995933CeC69566650f0 on chain 1",
          ),
        ),
      );
    });
  });

  describe("getImplementAddress", () => {
    it("should call axios with the ledger client version header", async () => {
      // GIVEN
      const version = `context-module/${PACKAGE.version}`;
      const requestSpy = vi.fn(() =>
        Promise.resolve({ data: implementationAddressDto }),
      );
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getProxyImplementationAddress(
        defaultImplementAddressParams,
      );

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: version,
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          },
        }),
      );
    });

    it("should make a GET request to the correct URL", async () => {
      // GIVEN
      const requestSpy = vi.fn(() =>
        Promise.resolve({ data: implementationAddressDto }),
      );
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      // WHEN
      await datasource.getProxyImplementationAddress(
        defaultImplementAddressParams,
      );

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "https://nft.api.live.ledger.com/v1/ethereum/1/contract/proxy/0xee6a57ec80ea46401049e92587e52f5ec1c24785",
        }),
      );
    });

    it("should use the provided chainId in the URL", async () => {
      // GIVEN
      const requestSpy = vi.fn(() =>
        Promise.resolve({ data: implementationAddressDto }),
      );
      vi.spyOn(axios, "request").mockImplementation(requestSpy);

      const paramsWithDifferentChainId: GetProxyImplementationAddressParam = {
        proxyAddress: "0xee6a57ec80ea46401049e92587e52f5ec1c24785",
        chainId: 137, // Polygon
      };

      // WHEN
      await datasource.getProxyImplementationAddress(
        paramsWithDifferentChainId,
      );

      // THEN
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "https://nft.api.live.ledger.com/v1/ethereum/137/contract/proxy/0xee6a57ec80ea46401049e92587e52f5ec1c24785",
        }),
      );
    });

    it("should return the implementation address response on success", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValue({
        data: implementationAddressDto,
      });

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        defaultImplementAddressParams,
      );

      // THEN
      expect(result).toEqual(Right(implementationAddressResponse));
    });

    it("should return an error when axios throws an error", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockRejectedValue(new Error("network error"));

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        defaultImplementAddressParams,
      );

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpProxyDataSource: Failed to fetch implementation address",
          ),
        ),
      );
    });

    it("should return an error if response shape is invalid", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValue({
        data: { invalid: "data" },
      });

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        defaultImplementAddressParams,
      );

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpProxyDataSource: Invalid proxy implementation address response format for proxy 0xee6a57ec80ea46401049e92587e52f5ec1c24785 on chain 1",
          ),
        ),
      );
    });

    it("should return an error if no dto is returned from the api", async () => {
      // GIVEN
      vi.spyOn(axios, "request").mockResolvedValue({
        data: undefined,
      });

      // WHEN
      const result = await datasource.getProxyImplementationAddress(
        defaultImplementAddressParams,
      );

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpProxyDataSource: No data received for proxy 0xee6a57ec80ea46401049e92587e52f5ec1c24785 on chain 1",
          ),
        ),
      );
    });
  });
});
