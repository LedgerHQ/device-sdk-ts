import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type NftDataSource } from "@/modules/ethereum/nft/data/NftDataSource";
import {
  type NftContextInput,
  NftContextLoader,
} from "@/modules/ethereum/nft/domain/NftContextLoader";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

describe("NftContextLoader", () => {
  const spyGetNftInfosPayload = vi.fn();
  const spyGetPluginPayload = vi.fn();
  const spyLoadCertificate = vi.fn();
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: spyLoadCertificate,
  };
  const pluginCertificate = {
    keyUsageNumber: 7,
    payload: new Uint8Array([0x07]),
  };
  const nftCertificate = {
    keyUsageNumber: 3,
    payload: new Uint8Array([0x03]),
  };
  let mockDataSource: NftDataSource;
  let loader: NftContextLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    spyLoadCertificate.mockClear();
    mockDataSource = {
      getNftInfosPayload: spyGetNftInfosPayload,
      getSetPluginPayload: spyGetPluginPayload,
    };
    spyLoadCertificate.mockImplementation(({ keyUsage }) =>
      Promise.resolve(
        keyUsage === KeyUsage.PluginMeta ? pluginCertificate : nftCertificate,
      ),
    );
    loader = new NftContextLoader(mockDataSource, mockCertificateLoader);
  });

  describe("canHandle function", () => {
    const validInput: NftContextInput = {
      to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      selector: "0x095ea7b3",
      chainId: 1,
      deviceModelId: DeviceModelId.STAX,
    };

    it("should return true for valid input", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.ETHEREUM_NFT,
          ClearSignContextType.ETHEREUM_PLUGIN,
        ]),
      ).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(
        loader.canHandle(validInput, [ClearSignContextType.ETHEREUM_TOKEN]),
      ).toBe(false);
      expect(
        loader.canHandle(validInput, [ClearSignContextType.ETHEREUM_PLUGIN]),
      ).toBe(false);
      expect(
        loader.canHandle(validInput, [ClearSignContextType.ETHEREUM_NFT]),
      ).toBe(false);
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
      [123, "number input"],
      [{ ...validInput, to: undefined }, "missing to"],
      [{ ...validInput, selector: undefined }, "missing selector"],
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, deviceModelId: undefined }, "missing deviceModelId"],
      [{ ...validInput, to: "invalid-hex" }, "invalid to hex"],
      [{ ...validInput, to: "0x" }, "empty to hex"],
      [{ ...validInput, selector: "invalid-hex" }, "invalid selector hex"],
      [{ ...validInput, selector: "0x" }, "empty selector hex"],
      [{ ...validInput, selector: "0x00000000" }, "different selector"],
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.ETHEREUM_NFT,
          ClearSignContextType.ETHEREUM_PLUGIN,
        ]),
      ).toBe(false);
    });
  });

  describe("load function", () => {
    it("should return an error when datasource get plugin payload return a Left", async () => {
      const input: NftContextInput = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        selector: "0x095ea7b3",
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      spyGetPluginPayload.mockResolvedValueOnce(Left(new Error("error")));

      const result = await loader.load(input);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
      ]);
      expect(spyLoadCertificate).not.toHaveBeenCalled();
    });

    it("should return an error when datasource get nft infos payload return a Left", async () => {
      const input: NftContextInput = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        selector: "0x095ea7b3",
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      spyGetPluginPayload.mockResolvedValueOnce(Right("payload1"));
      spyGetNftInfosPayload.mockResolvedValueOnce(Left(new Error("error")));

      const result = await loader.load(input);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("error"),
        },
      ]);
    });

    it("should return the plugin and the nft with their certificates", async () => {
      const input: NftContextInput = {
        to: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        selector: "0x095ea7b3",
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      spyGetPluginPayload.mockResolvedValueOnce(Right("payload1"));
      spyGetNftInfosPayload.mockResolvedValueOnce(Right("payload2"));

      const result = await loader.load(input);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ETHEREUM_PLUGIN,
          payload: "payload1",
          certificate: pluginCertificate,
        },
        {
          type: ClearSignContextType.ETHEREUM_NFT,
          payload: "payload2",
          certificate: nftCertificate,
        },
      ]);
      expect(spyLoadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.PluginSelectorKey,
        keyUsage: KeyUsage.PluginMeta,
        targetDevice: DeviceModelId.STAX,
      });
      expect(spyLoadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.NftMetadataKey,
        keyUsage: KeyUsage.NftMeta,
        targetDevice: DeviceModelId.STAX,
      });
    });
  });
});
