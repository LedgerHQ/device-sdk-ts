import { type HexaString } from "@ledgerhq/device-management-kit";

export type Signature = { r: HexaString; s: HexaString; v: number };
