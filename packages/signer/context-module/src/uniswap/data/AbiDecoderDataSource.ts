import { type HexaString } from "@ledgerhq/device-management-kit";

export interface AbiDecoderDataSource {
  decode(types: string[], data: HexaString): unknown[];
}
