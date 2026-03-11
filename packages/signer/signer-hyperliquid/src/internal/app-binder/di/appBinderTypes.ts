import type { HexaString } from "@ledgerhq/device-management-kit";

export const appBinderTypes = {
  AppBinding: Symbol.for("AppBinding"),
} as const;

/** Order structure used in Hyperliquid actions (create_order / update_order). */
export type Order = {
  a: number; // Asset
  b: boolean; // buy: true, sell: false
  p: string; // Price in USDC
  s: string; // Size is the price in coin/token unit
  r: boolean; // reduceOnly
  t:
    | {
        limit: {
          tif: "Alo" | "Ioc" | "Gtc";
        };
      }
    | {
        trigger: {
          isMarket: boolean;
          triggerPx: string;
          tpsl: "tp" | "sl";
        };
      }; // Type
};

/**
 * One action to send to the device. The task will serialize it to TLV
 * and send it via SendActionCommand.
 * Serialization follows specs.md "Set action to sign" (create_order / update_order / cancel_order / leverage / approveBuilderFee).
 */
export type HyperliquidAction =
  | {
      readonly type: "order";
      orders: Order[];
      grouping: "na" | "normalTpsl" | "positionTpsl";
      builder?: {
        b: HexaString;
        f: number;
      };
      nonce: number;
    }
  | {
      type: "modify";
      modifies: {
        oid: number;
        order: Order;
      }[];
      nonce: number;
    }
  | {
      type: "batchModify";
      modifies: {
        oid: number;
        order: Order;
      }[];
      nonce: number;
    }
  | {
      type: "cancel";
      cancels: {
        asset: number; // asset id
        oid: number; // oid
      }[];
      nonce: number;
    }
  | {
      type: "updateLeverage";
      asset: number; // index of coin
      isCross: boolean; // cross-leverage
      leverage: number;
      nonce: number;
    }
  | {
      type: "approveBuilderFee";
      hyperliquidChain: "Mainnet" | "Testnet";
      signatureChainId: string; // chainId in hex format. Ex: 0xa4b1 for Arbitrum
      maxFeeRate: string;
      builder: HexaString;
      nonce: number;
    }
  | {
      type: "updateIsolatedMargin";
      asset: number; // index of coin
      isBuy: boolean; // cross-leverage
      ntli: number;
      nonce: number;
    };
