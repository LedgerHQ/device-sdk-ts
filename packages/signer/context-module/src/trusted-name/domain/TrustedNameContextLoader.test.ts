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

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

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
    mockLoggerFactory,
  );

  const mockCertificate: PkiCertificate = {
    keyUsageNumber: 1,
    payload: new Uint8Array([1, 2, 3, 4]),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      mockTrustedNameDataSource,
      "getTrustedNamePayload",
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
      to: "0x1234567890abcdef1234567890abcdef12345678",
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
      [{ ...validInput, to: undefined }, "missing to"],
      [{ ...validInput, deviceModelId: undefined }, "missing device model"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TRUSTED_NAME])).toBe(
        false,
      );
    });

    it.each([
      [{ ...validInput, to: "0x" }, "empty to address (0x)"],
      [{ ...validInput, to: "not-hex" }, "non-hex to address"],
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, [ClearSignContextType.TRUSTED_NAME])).toBe(
        false,
      );
    });
  });

  describe("load function", () => {
    it("should return a payload", async () => {
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );
      const input: TrustedNameContextInput = {
        chainId: 1,
        to: "0x1234567890abcdef1234567890abcdef12345678",
        challenge: "challenge",
        deviceModelId: DeviceModelId.STAX,
      };

      const result = await loader.load(input);

      expect(
        mockTrustedNameDataSource.getTrustedNamePayload,
      ).toHaveBeenCalledWith({
        chainId: 1,
        address: "0x1234567890abcdef1234567890abcdef12345678",
        challenge: "challenge",
        types: ["eoa"],
        sources: ["ens"],
      });
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
        to: "0x1234567890abcdef1234567890abcdef12345678",
        challenge: "challenge",
        deviceModelId: DeviceModelId.STAX,
      };

      // WHEN
      vi.spyOn(
        mockTrustedNameDataSource,
        "getTrustedNamePayload",
      ).mockResolvedValue(Left(new Error("error")));
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        { type: ClearSignContextType.ERROR, error: new Error("error") },
      ]);
    });
  });
});
