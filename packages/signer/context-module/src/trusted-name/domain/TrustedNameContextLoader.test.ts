import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import {
  type TrustedNameContextInput,
  TrustedNameContextLoader,
} from "@/trusted-name/domain/TrustedNameContextLoader";

describe("TrustedNameContextLoader", () => {
  const mockTrustedNameDataSource: TrustedNameDataSource = {
    getDomainNamePayload: vi.fn(),
    getTrustedNamePayload: vi.fn(),
  };
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };
  const loader = new TrustedNameContextLoader(
    mockTrustedNameDataSource,
    mockCertificateLoader,
  );

  const mockCertificate: PkiCertificate = {
    keyUsageNumber: 1,
    payload: new Uint8Array([1, 2, 3, 4]),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      mockTrustedNameDataSource,
      "getDomainNamePayload",
    ).mockResolvedValue(
      Right({
        data: "payload",
        keyId: "testKeyId",
        keyUsage: "testKeyUsage",
      }),
    );
  });

  describe("canHandle function", () => {
    const validInput: TrustedNameContextInput = {
      chainId: 1,
      domain: "hello.eth",
      challenge: "challenge",
      deviceModelId: DeviceModelId.STAX,
    };

    it("should return true for valid input", () => {
      expect(
        loader.canHandle(validInput, [ClearSignContextType.TRUSTED_NAME]),
      ).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        false,
      );
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
      [123, "number input"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TRUSTED_NAME])).toBe(
        false,
      );
    });

    it.each([
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, domain: undefined }, "missing domain"],
      [{ ...validInput, challenge: undefined }, "missing challenge"],
      [{ ...validInput, deviceModelId: undefined }, "missing device model"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TRUSTED_NAME])).toBe(
        false,
      );
    });

    it.each([
      [{ ...validInput, domain: "" }, "empty domain"],
      [{ ...validInput, challenge: "" }, "empty challenge"],
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
      [{ ...validInput, domain: 123 }, "numeric domain"],
      [{ ...validInput, challenge: 123 }, "numeric challenge"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TRUSTED_NAME])).toBe(
        false,
      );
    });
  });

  describe("load function", () => {
    it("should return an error when domain > max length", async () => {
      const input: TrustedNameContextInput = {
        chainId: 1,
        domain: "maxlength-maxlength-maxlength-maxlength-maxlength-maxlength",
        challenge: "challenge",
        deviceModelId: DeviceModelId.STAX,
      };

      const result = await loader.load(input);

      expect(mockCertificateLoader.loadCertificate).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("[ContextModule] TrustedNameLoader: invalid domain"),
        },
      ]);
    });

    it("should return an error when domain is not valid", async () => {
      const input: TrustedNameContextInput = {
        chainId: 1,
        domain: "hello👋",
        challenge: "challenge",
        deviceModelId: DeviceModelId.STAX,
      };

      const result = await loader.load(input);

      expect(mockCertificateLoader.loadCertificate).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("[ContextModule] TrustedNameLoader: invalid domain"),
        },
      ]);
    });

    it("should return a payload", async () => {
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );
      const input: TrustedNameContextInput = {
        chainId: 1,
        domain: "hello.eth",
        challenge: "challenge",
        deviceModelId: DeviceModelId.STAX,
      };

      const result = await loader.load(input);

      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: "testKeyId",
        keyUsage: "testKeyUsage",
        targetDevice: DeviceModelId.STAX,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.TRUSTED_NAME,
          payload: "payload",
          certificate: mockCertificate,
        },
      ]);
    });

    it("should return an error when unable to fetch the datasource", async () => {
      // GIVEN
      const input: TrustedNameContextInput = {
        chainId: 1,
        domain: "hello.eth",
        challenge: "challenge",
        deviceModelId: DeviceModelId.STAX,
      };

      // WHEN
      vi.spyOn(
        mockTrustedNameDataSource,
        "getDomainNamePayload",
      ).mockResolvedValue(Left(new Error("error")));
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        { type: ClearSignContextType.ERROR, error: new Error("error") },
      ]);
    });
  });
});
