import { type LKRPCommand } from "@internal/utils/LKRPCommand";

import { type ParsedTlvSegment } from "./Types";

export type LKRPBlockData = {
  parent: string;
  issuer: Uint8Array;
  commands: LKRPCommand[];
  signature: Uint8Array;
};

export type LKRPBlockParsedData = LKRPBlockData & { header: Uint8Array };

export type LKRPParsedTlvBlock = {
  bytes: Uint8Array;
  data: {
    version: ParsedTlvSegment<number>;
    parent: ParsedTlvSegment<string>;
    issuer: ParsedTlvSegment<Uint8Array>;
    commandsCount: ParsedTlvSegment<number>;
    commands: ParsedTlvSegment<LKRPCommand[]>;
    signature: ParsedTlvSegment<Uint8Array>;
  };
};
