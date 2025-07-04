import {
  type LKRPCommand,
  type LKRPCommandData,
} from "@api/app-binder/LKRPTypes";

import { bytesToHex, hexToBytes } from "./hex";
import { TLVParser } from "./TLVParser";
import { CommandTags } from "./TLVTags";

export class Command implements LKRPCommand {
  private data?: LKRPCommandData;
  private trustedMember?: Uint8Array;

  constructor(private bytes: Uint8Array) {}

  static fromHex(hex: string): Command {
    return new Command(hexToBytes(hex));
  }

  toString() {
    return bytesToHex(this.bytes);
  }

  toU8A() {
    return this.bytes;
  }

  getType() {
    const typeByte = this.bytes[0];
    if (!typeByte || !(typeByte in CommandTags)) {
      throw new Error(
        `Invalid command type: 0x${typeByte?.toString(16).padStart(2, "0")}`,
      );
    }
    return typeByte as CommandTags;
  }

  parse<T extends CommandTags>(): LKRPCommandData & { type: T } {
    if (!this.data) {
      this.data = new TLVParser(this.bytes).parseCommandData().caseOf({
        Left: (error) => {
          throw error;
        },
        Right: (data) => data,
      });
    }

    return this.data as LKRPCommandData & { type: T };
  }

  toHuman() {
    const data = this.parse();
    return Object.entries(data)
      .map(([key, value]) => {
        if (key === "type") {
          return `type: 0x${value?.toString(16).padStart(2, "0")}`;
        }
        if (value instanceof Uint8Array) {
          return `${key}: ${bytesToHex(value)}`;
        }
        return `${key}: ${value}`;
      })
      .join("\n");
  }

  getTrustedMember() {
    if (!this.trustedMember) {
      switch (this.getType()) {
        case CommandTags.AddMember:
          this.trustedMember = this.parse<CommandTags.AddMember>().publicKey;
          break;
        case CommandTags.PublishKey:
          this.trustedMember = this.parse<CommandTags.PublishKey>().recipient;
          break;
      }
    }
    return this.trustedMember;
  }
}
