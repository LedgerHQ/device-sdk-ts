import {
  HexaString,
  isHexaString,
  LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import type { NftDataSource } from "@/nft/data/NftDataSource";
import { nftTypes } from "@/nft/di/nftTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type NftContextInput = {
  to: HexaString;
  selector: HexaString;
  chainId: number;
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
  ClearSignContextType.PLUGIN,
  ClearSignContextType.NFT,
];

@injectable()
export class NftContextLoader implements ContextLoader<NftContextInput> {
  private _dataSource: NftDataSource;
  private logger: LoggerPublisherService;

  constructor(
    @inject(nftTypes.NftDataSource) dataSource: NftDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._dataSource = dataSource;
    this.logger = loggerFactory("NftContextLoader");
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
      SUPPORTED_TYPES.every((type) => expectedTypes.includes(type))
    );
  }

  async load(input: NftContextInput): Promise<ClearSignContext[]> {
    const responses: ClearSignContext[] = [];
    const { to, selector, chainId } = input;

    // EXAMPLE:
    // https://nft.api.live.ledger.com/v1/ethereum/1/contracts/0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/plugin-selector/0x095ea7b3
    const getPluginPayloadResponse = await this._dataSource.getSetPluginPayload(
      {
        chainId,
        address: to,
        selector,
      },
    );

    const pluginPayload = getPluginPayloadResponse.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.PLUGIN,
        payload: value,
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

    const nftInfosPayload = getNftInfosPayloadResponse.caseOf({
      Left: (error): ClearSignContext => ({
        type: ClearSignContextType.ERROR,
        error,
      }),
      Right: (value): ClearSignContext => ({
        type: ClearSignContextType.NFT,
        payload: value,
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
