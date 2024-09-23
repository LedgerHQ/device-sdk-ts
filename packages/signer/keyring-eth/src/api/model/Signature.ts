import { type HexaString } from "@ledgerhq/device-sdk-core";

export type Signature = { r: HexaString; s: HexaString; v: number };
