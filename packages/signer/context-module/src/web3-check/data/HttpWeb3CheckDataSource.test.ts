import { DeviceModelId } from "@ledgerhq/device-management-kit";
import axios from "axios";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { HttpWeb3CheckDataSource } from "@/web3-check/data/HttpWeb3CheckDataSource";
import { type Web3CheckDto } from "@/web3-check/data/Web3CheckDto";
import type { Web3CheckTypedData } from "@/web3-check/domain/web3CheckTypes";
import { type Web3CheckContext } from "@/web3-check/domain/web3CheckTypes";

vi.mock("axios");

describe("HttpWeb3CheckDataSource", () => {
  const config = {
    web3checks: {
      url: "web3checksUrl",
    },
  } as ContextModuleConfig;
  const certificateLoaderMock = {
    loadCertificate: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getWeb3Checks", () => {
    it("should return an object if the request is successful", async () => {
      // GIVEN
      const params: Web3CheckContext = {
        deviceModelId: DeviceModelId.FLEX,
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      };
      const dto: Web3CheckDto = {
        public_key_id: "partner",
        descriptor: "descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });
      vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValueOnce(
        undefined,
      );

      // WHEN
      const dataSource = new HttpWeb3CheckDataSource(
        config,
        certificateLoaderMock as unknown as PkiCertificateLoader,
      );
      const result = await dataSource.getWeb3Checks(params);

      // THEN
      expect(result).toEqual(
        Right({
          publicKeyId: "partner",
          descriptor: "descriptor",
        }),
      );
    });

    it("should return an object if the typed data request is successful", async () => {
      // GIVEN
      const params: Web3CheckContext = {
        deviceModelId: DeviceModelId.FLEX,
        from: "from",
        data: "typed data" as unknown as Web3CheckTypedData,
      };
      const dto: Web3CheckDto = {
        public_key_id: "partner",
        descriptor: "descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });
      vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValueOnce(
        undefined,
      );

      // WHEN
      const dataSource = new HttpWeb3CheckDataSource(
        config,
        certificateLoaderMock as unknown as PkiCertificateLoader,
      );
      const result = await dataSource.getWeb3Checks(params);

      // THEN
      expect(result).toEqual(
        Right({
          publicKeyId: "partner",
          descriptor: "descriptor",
        }),
      );
    });

    it("should return an object with a certificate if the request is successful", async () => {
      // GIVEN
      const params: Web3CheckContext = {
        deviceModelId: DeviceModelId.FLEX,
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      };
      const dto: Web3CheckDto = {
        public_key_id: "partner",
        descriptor: "descriptor",
      };
      vi.spyOn(axios, "request").mockResolvedValueOnce({ data: dto });
      vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValueOnce({
        keyUsageNumber: 11,
        payload: new Uint8Array([0x01]),
      });

      // WHEN
      const dataSource = new HttpWeb3CheckDataSource(
        config,
        certificateLoaderMock as unknown as PkiCertificateLoader,
      );
      const result = await dataSource.getWeb3Checks(params);

      // THEN
      expect(result).toEqual(
        Right({
          publicKeyId: "partner",
          descriptor: "descriptor",
          certificate: { keyUsageNumber: 11, payload: new Uint8Array([0x01]) },
        }),
      );
    });

    it("should return an error if the request fails", async () => {
      // GIVEN
      const params: Web3CheckContext = {
        deviceModelId: DeviceModelId.FLEX,
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      };
      vi.spyOn(axios, "request").mockRejectedValue(new Error("error"));

      // WHEN
      const dataSource = new HttpWeb3CheckDataSource(
        config,
        certificateLoaderMock as unknown as PkiCertificateLoader,
      );
      const result = await dataSource.getWeb3Checks(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpWeb3CheckDataSource: Failed to fetch web3 checks informations",
          ),
        ),
      );
    });

    it("should return an error if the response is invalid", async () => {
      // GIVEN
      const params: Web3CheckContext = {
        deviceModelId: DeviceModelId.FLEX,
        from: "from",
        rawTx: "rawTx",
        chainId: 1,
      };
      const dto = {};
      vi.spyOn(axios, "request").mockResolvedValue({ data: dto });
      vi.spyOn(certificateLoaderMock, "loadCertificate").mockResolvedValue(
        undefined,
      );

      // WHEN
      const dataSource = new HttpWeb3CheckDataSource(
        config,
        certificateLoaderMock as unknown as PkiCertificateLoader,
      );
      const result = await dataSource.getWeb3Checks(params);

      // THEN
      expect(result).toEqual(
        Left(
          new Error(
            "[ContextModule] HttpWeb3CheckDataSource: Cannot exploit Web3 checks data received",
          ),
        ),
      );
    });
  });
});
