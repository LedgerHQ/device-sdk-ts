import { type HexaString } from "@ledgerhq/device-sdk-core";

export type Address = {
  address: HexaString;
  publicKey: string;
  chainCode?: string;
};
