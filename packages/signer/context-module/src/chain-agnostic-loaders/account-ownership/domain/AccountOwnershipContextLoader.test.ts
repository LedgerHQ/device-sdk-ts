import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import type {
  AccountOwnershipDataSource,
  AccountOwnershipDescriptor,
} from "@/chain-agnostic-loaders/account-ownership/data/AccountOwnershipDataSource";
import {
  type AccountOwnershipContextInput,
  AccountOwnershipContextLoader,
} from "@/chain-agnostic-loaders/account-ownership/domain/AccountOwnershipContextLoader";
import { type PkiCertificateLoader } from "@/chain-agnostic-loaders/pki/domain/PkiCertificateLoader";
import { type PkiCertificate } from "@/chain-agnostic-loaders/pki/model/PkiCertificate";
import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

describe("AccountOwnershipContextLoader", () => {
  const mockDataSource: AccountOwnershipDataSource = {
    getDescriptor: vi.fn(),
  };
  const mockPkiCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };
  const loader = new AccountOwnershipContextLoader(
    mockDataSource,
    mockPkiCertificateLoader,
  );

  const mockCertificate: PkiCertificate = {
    keyUsageNumber: 4,
    payload: new Uint8Array([1, 2, 3]),
  };

  const mockDescriptor: AccountOwnershipDescriptor = {
    signedDescriptor: "account-ownership-descriptor-payload",
    keyId: "domain_metadata_key",
    keyUsage: "trusted_name",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mockPkiCertificateLoader, "loadCertificate").mockResolvedValue(
      mockCertificate,
    );
  });

  describe("canHandle", () => {
    const validInput: AccountOwnershipContextInput = {
      publicKey: "abcdef1234567890",
      address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
      network: "mainnet",
      deviceModelId: DeviceModelId.FLEX,
      challenge: "0xabcdef",
    };

    it("should return true for valid input with ACCOUNT_OWNERSHIP type", () => {
      expect(
        loader.canHandle(validInput, [ClearSignContextType.ACCOUNT_OWNERSHIP]),
      ).toBe(true);
    });

    it("should return false when expected types include unsupported types", () => {
      expect(
        loader.canHandle(validInput, [ClearSignContextType.ETHEREUM_TOKEN]),
      ).toBe(false);
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.ETHEREUM_TRUSTED_NAME,
        ]),
      ).toBe(false);
    });

    it("should return true when expected types include ACCOUNT_OWNERSHIP among others", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.ACCOUNT_OWNERSHIP,
          ClearSignContextType.ETHEREUM_TOKEN,
        ]),
      ).toBe(true);
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
      [123, "number input"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [ClearSignContextType.ACCOUNT_OWNERSHIP]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, publicKey: undefined }, "missing publicKey"],
      [{ ...validInput, address: undefined }, "missing address"],
      [{ ...validInput, network: undefined }, "missing network"],
      [{ ...validInput, deviceModelId: undefined }, "missing deviceModelId"],
      [{ ...validInput, challenge: undefined }, "missing challenge"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [ClearSignContextType.ACCOUNT_OWNERSHIP]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, publicKey: "" }, "empty publicKey"],
      [{ ...validInput, address: "" }, "empty address"],
      [{ ...validInput, challenge: "" }, "empty challenge"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [ClearSignContextType.ACCOUNT_OWNERSHIP]),
      ).toBe(false);
    });

    it("should return false for invalid network value", () => {
      expect(
        loader.canHandle({ ...validInput, network: "devnet" }, [
          ClearSignContextType.ACCOUNT_OWNERSHIP,
        ]),
      ).toBe(false);
    });

    it("should return true for testnet network", () => {
      expect(
        loader.canHandle({ ...validInput, network: "testnet" }, [
          ClearSignContextType.ACCOUNT_OWNERSHIP,
        ]),
      ).toBe(true);
    });

    it("should return true for different device models", () => {
      for (const deviceModelId of [
        DeviceModelId.NANO_S,
        DeviceModelId.NANO_SP,
        DeviceModelId.NANO_X,
        DeviceModelId.STAX,
        DeviceModelId.FLEX,
      ]) {
        expect(
          loader.canHandle({ ...validInput, deviceModelId }, [
            ClearSignContextType.ACCOUNT_OWNERSHIP,
          ]),
        ).toBe(true);
      }
    });
  });

  describe("load", () => {
    const input: AccountOwnershipContextInput = {
      publicKey: "abcdef1234567890",
      address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
      network: "mainnet",
      deviceModelId: DeviceModelId.FLEX,
      challenge: "0xabcdef",
    };

    it("should return ACCOUNT_OWNERSHIP context with certificate", async () => {
      // GIVEN
      vi.spyOn(mockDataSource, "getDescriptor").mockResolvedValue(
        Right(mockDescriptor),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(mockDataSource.getDescriptor).toHaveBeenCalledWith({
        publicKey: "abcdef1234567890",
        address: "3kFkntk2H5FGMzeR3GjQKPhdZK9LShKdPHsj2fiGKCdmDXj2WB",
        challenge: "0xabcdef",
        network: "mainnet",
      });
      expect(mockPkiCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: "domain_metadata_key",
        keyUsage: "trusted_name",
        targetDevice: DeviceModelId.FLEX,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.ACCOUNT_OWNERSHIP,
          payload: "account-ownership-descriptor-payload",
          certificate: mockCertificate,
        },
      ]);
    });

    it("should return ACCOUNT_OWNERSHIP context without certificate when loadCertificate returns undefined", async () => {
      // GIVEN
      vi.spyOn(mockDataSource, "getDescriptor").mockResolvedValue(
        Right(mockDescriptor),
      );
      vi.spyOn(mockPkiCertificateLoader, "loadCertificate").mockResolvedValue(
        undefined,
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ACCOUNT_OWNERSHIP,
          payload: "account-ownership-descriptor-payload",
          certificate: undefined,
        },
      ]);
    });

    it("should return ERROR context when data source returns Left", async () => {
      // GIVEN
      const error = new Error("Failed to get descriptor");
      vi.spyOn(mockDataSource, "getDescriptor").mockResolvedValue(Left(error));

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
      expect(mockPkiCertificateLoader.loadCertificate).not.toHaveBeenCalled();
    });

    it("should pass correct device model to certificate loader", async () => {
      // GIVEN
      const inputNanoX = { ...input, deviceModelId: DeviceModelId.NANO_X };
      vi.spyOn(mockDataSource, "getDescriptor").mockResolvedValue(
        Right(mockDescriptor),
      );

      // WHEN
      await loader.load(inputNanoX);

      // THEN
      expect(mockPkiCertificateLoader.loadCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          targetDevice: DeviceModelId.NANO_X,
        }),
      );
    });

    it("should pass testnet network to data source", async () => {
      // GIVEN
      const inputTestnet = { ...input, network: "testnet" as const };
      vi.spyOn(mockDataSource, "getDescriptor").mockResolvedValue(
        Right(mockDescriptor),
      );

      // WHEN
      await loader.load(inputTestnet);

      // THEN
      expect(mockDataSource.getDescriptor).toHaveBeenCalledWith(
        expect.objectContaining({
          network: "testnet",
        }),
      );
    });

    it("should handle long descriptor payloads", async () => {
      // GIVEN
      const longPayload = "a".repeat(1000);
      vi.spyOn(mockDataSource, "getDescriptor").mockResolvedValue(
        Right({ ...mockDescriptor, signedDescriptor: longPayload }),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect((result[0] as ClearSignContextSuccess).payload).toBe(longPayload);
    });
  });
});
