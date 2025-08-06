import { type LKRPCommand } from "@internal/utils/LKRPCommand";

export type LKRPBlockData = {
  parent: string;
  issuer: Uint8Array;
  commands: LKRPCommand[];
  signature: Uint8Array;
};

export type LKRPBlockParsedData = LKRPBlockData & { header: Uint8Array };
