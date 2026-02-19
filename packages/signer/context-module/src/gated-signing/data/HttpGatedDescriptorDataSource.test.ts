import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpGatedDescriptorDataSource } from "@/gated-signing/data/HttpGatedDescriptorDataSource";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

vi.mock("axios");

describe("HttpGatedDescriptorDataSource", () => {
  const config: ContextModuleConfig = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com/v1",
      branch: "next",
      mode: "prod",
    },
    originToken: "test-origin-token",
  } as ContextModuleConfig;

  const contractAddress = "0x1111111254fb6c44bac0bed2854e76f90643097d";
  const selector = "0xa1251d75";
  const chainId = 1;

  const descriptorPayload =
    "010122020101222a30783131313131313235346662366334346261633062656432383534653736663930363433303937642308000000000000000140086131323531643735";
  const validGatedDappsResponse = [
    {
      gated_descriptors: {
        "0x1111111254fb6c44bac0bed2854e76f90643097d": {
          a1251d75: {
            network: "ethereum",
            chain_id: 1,
            address: "0x1111111254fb6c44bac0bed2854e76f90643097d",
            selector: "a1251d75",
            version: "v1",
            descriptor: descriptorPayload,
            signatures: { prod: "00", test: "00" },
          },
        },
      },
    },
  ];
  // signedDescriptor = payload + SIGNATURE_TAG("15") + length(01) + signature("00")
  const expectedSignedDescriptor = `${descriptorPayload}150100`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGatedDescriptor", () => {
    it("should return descriptor on successful request with correct URL and params", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validGatedDappsResponse,
      });

      const result = await new HttpGatedDescriptorDataSource(
        config,
      ).getGatedDescriptor({
        contractAddress,
        selector,
        chainId,
      });

      expect(axios.request).toHaveBeenCalledWith({
        method: "GET",
        url: "https://crypto-assets-service.api.ledger.com/v1/gated_dapps",
        params: {
          ref: "branch:next",
          output: "gated_descriptors",
          contracts: contractAddress,
          chain_id: chainId,
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: "test-origin-token",
        },
      });
      expect(result).toEqual(
        Right({
          signedDescriptor: expectedSignedDescriptor,
        }),
      );
    });

    it("should find descriptor when API response has selector key without 0x prefix", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validGatedDappsResponse,
      });

      const result = await new HttpGatedDescriptorDataSource(
        config,
      ).getGatedDescriptor({
        contractAddress,
        selector: "0xa1251d75",
        chainId,
      });

      expect(result).toEqual(
        Right({
          signedDescriptor: expectedSignedDescriptor,
        }),
      );
    });

    it("should return Left when response is not an array", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: { gated_descriptors: {} },
      });

      const result = await new HttpGatedDescriptorDataSource(
        config,
      ).getGatedDescriptor({
        contractAddress,
        selector,
        chainId,
      });

      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpGatedDescriptorDataSource: Invalid gated descriptors response",
          ),
        ),
      );
    });

    it("should return Left when response is empty array", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: [],
      });

      const result = await new HttpGatedDescriptorDataSource(
        config,
      ).getGatedDescriptor({
        contractAddress,
        selector,
        chainId,
      });

      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpGatedDescriptorDataSource: Invalid gated descriptors response",
          ),
        ),
      );
    });

    it("should return Left when no descriptor matches contract and selector", async () => {
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: [
          {
            gated_descriptors: {
              "0xothercontract": {
                a1251d75: {
                  descriptor: "some-descriptor",
                  network: "ethereum",
                  chain_id: 1,
                  address: "0xother",
                  selector: "a1251d75",
                  version: "v1",
                },
              },
            },
          },
        ],
      });

      const result = await new HttpGatedDescriptorDataSource(
        config,
      ).getGatedDescriptor({
        contractAddress,
        selector,
        chainId,
      });

      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpGatedDescriptorDataSource: No gated descriptor for contract 0x1111111254fb6c44bac0bed2854e76f90643097d and selector 0xa1251d75",
          ),
        ),
      );
    });

    it("should return Left when axios request fails", async () => {
      vi.spyOn(axios, "request").mockRejectedValue(new Error("Network error"));

      const result = await new HttpGatedDescriptorDataSource(
        config,
      ).getGatedDescriptor({
        contractAddress,
        selector,
        chainId,
      });

      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpGatedDescriptorDataSource: Failed to fetch gated descriptors: Error: Network error",
          ),
        ),
      );
    });

    it("should use config.cal.branch in ref param", async () => {
      const configMain: ContextModuleConfig = {
        ...config,
        cal: { ...config.cal!, branch: "main" },
      } as ContextModuleConfig;
      vi.spyOn(axios, "request").mockResolvedValue({
        status: 200,
        data: validGatedDappsResponse,
      });

      await new HttpGatedDescriptorDataSource(configMain).getGatedDescriptor({
        contractAddress,
        selector,
        chainId,
      });

      expect(axios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            ref: "branch:main",
          }),
        }),
      );
    });

    describe("when response fails DTO validation", () => {
      const invalidResponseError = new Error(
        "[ContextModule] HttpGatedDescriptorDataSource: Invalid gated descriptors response",
      );

      it("should return Left when array item has no gated_descriptors", async () => {
        vi.spyOn(axios, "request").mockResolvedValue({
          status: 200,
          data: [{}],
        });

        const result = await new HttpGatedDescriptorDataSource(
          config,
        ).getGatedDescriptor({
          contractAddress,
          selector,
          chainId,
        });

        expect(result).toEqual(Left(invalidResponseError));
      });

      it("should return Left when gated_descriptors is not an object", async () => {
        vi.spyOn(axios, "request").mockResolvedValue({
          status: 200,
          data: [{ gated_descriptors: "not-an-object" }],
        });

        const result = await new HttpGatedDescriptorDataSource(
          config,
        ).getGatedDescriptor({
          contractAddress,
          selector,
          chainId,
        });

        expect(result).toEqual(Left(invalidResponseError));
      });

      it("should return Left when entry is missing required field (descriptor)", async () => {
        vi.spyOn(axios, "request").mockResolvedValue({
          status: 200,
          data: [
            {
              gated_descriptors: {
                [contractAddress]: {
                  a1251d75: {
                    network: "ethereum",
                    chain_id: 1,
                    address: contractAddress,
                    selector: "a1251d75",
                    version: "v1",
                    // descriptor missing
                  },
                },
              },
            },
          ],
        });

        const result = await new HttpGatedDescriptorDataSource(
          config,
        ).getGatedDescriptor({
          contractAddress,
          selector,
          chainId,
        });

        expect(result).toEqual(Left(invalidResponseError));
      });

      it("should return Left when entry has wrong type for chain_id", async () => {
        vi.spyOn(axios, "request").mockResolvedValue({
          status: 200,
          data: [
            {
              gated_descriptors: {
                [contractAddress]: {
                  a1251d75: {
                    network: "ethereum",
                    chain_id: "1", // string instead of number
                    address: contractAddress,
                    selector: "a1251d75",
                    version: "v1",
                    descriptor: descriptorPayload,
                    signatures: { prod: "00", test: "00" },
                  },
                },
              },
            },
          ],
        });

        const result = await new HttpGatedDescriptorDataSource(
          config,
        ).getGatedDescriptor({
          contractAddress,
          selector,
          chainId,
        });

        expect(result).toEqual(Left(invalidResponseError));
      });

      it("should return Left when entry signatures contains non-string value", async () => {
        vi.spyOn(axios, "request").mockResolvedValue({
          status: 200,
          data: [
            {
              gated_descriptors: {
                [contractAddress]: {
                  a1251d75: {
                    network: "ethereum",
                    chain_id: 1,
                    address: contractAddress,
                    selector: "a1251d75",
                    version: "v1",
                    descriptor: descriptorPayload,
                    signatures: { prod: 123 }, // number instead of string
                  },
                },
              },
            },
          ],
        });

        const result = await new HttpGatedDescriptorDataSource(
          config,
        ).getGatedDescriptor({
          contractAddress,
          selector,
          chainId,
        });

        expect(result).toEqual(Left(invalidResponseError));
      });

      it("should return Left when array item is null", async () => {
        vi.spyOn(axios, "request").mockResolvedValue({
          status: 200,
          data: [null],
        });

        const result = await new HttpGatedDescriptorDataSource(
          config,
        ).getGatedDescriptor({
          contractAddress,
          selector,
          chainId,
        });

        expect(result).toEqual(Left(invalidResponseError));
      });

      it("should return Left when selectors map value is not an object", async () => {
        vi.spyOn(axios, "request").mockResolvedValue({
          status: 200,
          data: [
            {
              gated_descriptors: {
                [contractAddress]: "not-a-selectors-map",
              },
            },
          ],
        });

        const result = await new HttpGatedDescriptorDataSource(
          config,
        ).getGatedDescriptor({
          contractAddress,
          selector,
          chainId,
        });

        expect(result).toEqual(Left(invalidResponseError));
      });
    });
  });
});
