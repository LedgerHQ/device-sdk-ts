import { inject } from "inversify";

import type { NftDataSource } from "@/nft/data/NftDataSource";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import { ClearSignContext } from "@/shared/model/ClearSignContext";
import { HexString, isHexString } from "@/shared/model/HexString";
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

const SUPPORTED_SELECTORS: HexString[] = [
  ...Object.values(ERC721_SUPPORTED_SELECTOR),
  ...Object.values(ERC1155_SUPPORTED_SELECTOR),
];

export class NftContextLoader implements ContextLoader {
  private _dataSource: NftDataSource;

  constructor(@inject("NftDataSource") dataSource: NftDataSource) {
    this._dataSource = dataSource;
  }

  async load(transaction: TransactionContext): Promise<ClearSignContext[]> {
    const responses: ClearSignContext[] = [];

    if (!transaction.to || !transaction.data || transaction.data === "0x") {
      return [];
    }

    const selector = transaction.data.slice(0, 10);

    if (!isHexString(selector)) {
      return [{ type: "error", error: new Error("Invalid selector") }];
    }

    if (!this.isSelectorSupported(selector)) {
      return [];
    }

    // EXAMPLE:
    // https://nft.api.live.ledger.com/v1/ethereum/1/contracts/0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/plugin-selector/0x095ea7b3
    const pluginPayload = await this._dataSource.getSetPluginPayload({
      chainId: transaction.chainId,
      address: transaction.to,
      selector,
    });

    const payload = pluginPayload.caseOf({
      Left: (error): ClearSignContext => ({
        type: "error",
        error,
      }),
      Right: (value): ClearSignContext => {
        if (!value) {
          return {
            type: "error",
            error: new Error(
              "[ContextModule] NftLoader: unexpected empty response",
            ),
          };
        }

        return { type: "plugin", payload: value };
      },
    });

    if (payload.type === "error") {
      return [payload];
    }

    responses.push(payload);

    const nftInformationsPayload = await this._dataSource.getNftInfosPayload({
      chainId: transaction.chainId,
      address: transaction.to,
    });

    const secondPayload = nftInformationsPayload.caseOf({
      Left: (error): ClearSignContext => ({
        type: "error",
        error,
      }),
      Right: (value): ClearSignContext => {
        if (!value) {
          return {
            type: "error",
            error: new Error("[ContextModule] NftLoader: no nft metadata"),
          };
        }

        return { type: "nft", payload: value };
      },
    });

    if (secondPayload.type === "error") {
      return [secondPayload];
    }

    responses.push(secondPayload);

    return responses;
  }

  private isSelectorSupported(selector: HexString) {
    return Object.values(SUPPORTED_SELECTORS).includes(selector);
  }
}
