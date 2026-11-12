import {
  DeviceModelId,
  getLogger,
  HexaString,
  isHexaString,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import type { NftDataSource } from "@/modules/ethereum/nft/data/NftDataSource";
import { nftTypes } from "@/modules/ethereum/nft/di/nftTypes";
import { pkiTypes } from "@/modules/multichain/pki/di/pkiTypes";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type NftContextInput = {
  to: HexaString;
  selector: HexaString;
  chainId: number;
  deviceModelId: DeviceModelId;
};

enum ERC721_SUPPORTED_SELECTOR {
  Approve = "0x095ea7b3",
  SetApprovalForAll = "0xa22cb465",
  TransferFrom = "0x23b872dd",
  SafeTransferFrom = "0x42842e0e",
  SafeTransferFromWithData = "0xb88d4fde",
}

enum ERC1155_SUPPORTED_SELECTOR {
  SetApprovalForAll = "0xa22cb465",
  SafeTransferFrom = "0xf242432a",
  SafeBatchTransferFrom = "0x2eb2c2d6",
}

const SUPPORTED_SELECTORS: HexaString[] = [
  ...Object.values(ERC721_SUPPORTED_SELECTOR),
  ...Object.values(ERC1155_SUPPORTED_SELECTOR),
];

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_PLUGIN,
  ClearSignContextType.ETHEREUM_NFT,
];

@injectable()
export class NftContextLoader implements ContextLoader<NftContextInput> {
  private _dataSource: NftDataSource;
  private _certificateLoader: PkiCertificateLoader;
  private logger: LoggerPublisherService;

  constructor(
    @inject(nftTypes.NftDataSource) dataSource: NftDataSource,
    @inject(pkiTypes.PkiCertificateLoader)
    certificateLoader: PkiCertificateLoader,
  ) {
    this._dataSource = dataSource;
    this._certificateLoader = certificateLoader;
    this.logger = getLogger("ContextModule", "NftContextLoader");
  }

  canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is NftContextInput {
    return (
      typeof input === "object" &&
      input !== null &&
      "to" in input &&
      "selector" in input &&
      "chainId" in input &&
      typeof input.chainId === "number" &&
      isHexaString(input.to) &&
      input.to !== "0x" &&
      isHexaString(input.selector) &&
      this.isSelectorSupported(input.selector) &&
      "deviceModelId" in input &&
      input.deviceModelId !== undefined &&
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: NftContextInput): Promise<ClearSignContext[]> {
    const responses: ClearSignContext[] = [];
    const { to, selector, chainId, deviceModelId } = input;

    // EXAMPLE:
    // https://nft.api.live.ledger.com/v1/ethereum/1/contracts/0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/plugin-selector/0x095ea7b3
    const getPluginPayloadResponse = await this._dataSource.getSetPluginPayload(
      {
        chainId,
        address: to,
        selector,
      },
    );

    const pluginCertificate = getPluginPayloadResponse.isRight()
      ? await this._certificateLoader.loadCertificate({
          keyId: KeyId.PluginSelectorKey,
          keyUsage: KeyUsage.PluginMeta,
          targetDevice: deviceModelId,
        })
      : undefined;

    const pluginPayload = getPluginPayloadResponse.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.ETHEREUM_PLUGIN,
        payload: value,
        certificate: pluginCertificate,
      }),
    });

    if (pluginPayload.type === ClearSignContextType.ERROR) {
      this.logger.debug("load result", { data: { result: [pluginPayload] } });
      return [pluginPayload];
    }

    responses.push(pluginPayload);

    const getNftInfosPayloadResponse =
      await this._dataSource.getNftInfosPayload({
        chainId,
        address: to,
      });

    const nftCertificate = getNftInfosPayloadResponse.isRight()
      ? await this._certificateLoader.loadCertificate({
          keyId: KeyId.NftMetadataKey,
          keyUsage: KeyUsage.NftMeta,
          targetDevice: deviceModelId,
        })
      : undefined;

    const nftInfosPayload = getNftInfosPayloadResponse.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.ETHEREUM_NFT,
        payload: value,
        certificate: nftCertificate,
      }),
    });

    if (nftInfosPayload.type === ClearSignContextType.ERROR) {
      this.logger.debug("load result", { data: { result: [nftInfosPayload] } });
      return [nftInfosPayload];
    }

    responses.push(nftInfosPayload);

    this.logger.debug("load result", { data: { result: responses } });
    return responses;
  }

  private isSelectorSupported(selector: HexaString) {
    return Object.values(SUPPORTED_SELECTORS).includes(selector);
  }
}
