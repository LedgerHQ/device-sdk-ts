import { HexaString, isHexaString } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import type { NftDataSource } from "@/nft/data/NftDataSource";
import { nftTypes } from "@/nft/di/nftTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import { TransactionContext } from "@/shared/model/TransactionContext";

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

@injectable()
export class NftContextLoader implements ContextLoader {
  private _dataSource: NftDataSource;

  constructor(@inject(nftTypes.NftDataSource) dataSource: NftDataSource) {
    this._dataSource = dataSource;
  }

  async load(ctx: TransactionContext): Promise<ClearSignContext[]> {
    const responses: ClearSignContext[] = [];

    const { to, selector, chainId } = ctx;
    if (to === undefined) {
      return [];
    }

    if (!isHexaString(selector)) {
      return [
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Invalid selector"),
        },
      ];
    }

    if (!this.isSelectorSupported(selector)) {
      return [];
    }

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
      return [nftInfosPayload];
    }

    responses.push(nftInfosPayload);

    return responses;
  }

  private isSelectorSupported(selector: HexaString) {
    return Object.values(SUPPORTED_SELECTORS).includes(selector);
  }
}
