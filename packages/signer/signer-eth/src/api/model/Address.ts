import { type HexaString } from "@ledgerhq/device-management-kit";

export type Address = {
  address: HexaString;
  publicKey: string;
  chainCode?: string;
};
