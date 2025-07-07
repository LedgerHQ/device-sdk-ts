import { type Either, Just, type Maybe, Nothing } from "purify-ts";

import { type LKRPParsingError } from "@api/app-binder/Errors";

import { bytesToHex, hexToBytes } from "./hex";
import { TLVParser } from "./TLVParser";
import { CommandTags } from "./TLVTags";
import { type LKRPCommandData } from "./types";

export class LKRPCommand {
  private data: Maybe<Either<LKRPParsingError, LKRPCommandData>> = Nothing;

  constructor(private bytes: Uint8Array) {}

  static fromHex(hex: string): LKRPCommand {
    return new LKRPCommand(hexToBytes(hex));
  }

  toString(): string {
    return bytesToHex(this.bytes);
  }

  toU8A(): Uint8Array {
    return this.bytes;
  }

  parse(): Either<LKRPParsingError, LKRPCommandData> {
    return this.data.orDefaultLazy(() => {
      const data = new TLVParser(this.bytes).parseCommandData();
      this.data = Just(data);
      return data;
    });
  }

  toHuman(): Either<LKRPParsingError, string> {
    return this.parse().map((data) =>
      Object.entries(data)
        .map(([key, value]) => {
          if (key === "type") {
            return `${CommandTags[value as CommandTags]}(0x${value?.toString(16).padStart(2, "0")}):`;
          }
          return `  ${key}: ${value instanceof Uint8Array ? bytesToHex(value) : value}`;
        })
        .join("\n"),
    );
  }

  getTrustedMember(): Maybe<Uint8Array> {
    if (
      ![CommandTags.AddMember, CommandTags.PublishKey].includes(
        this.bytes[0] ?? NaN,
      )
    ) {
      return Nothing;
    }
    return this.parse()
      .toMaybe()
      .chain((data) => {
        switch (data.type) {
          case CommandTags.AddMember:
            return Just(data.publicKey);
          case CommandTags.PublishKey:
            return Just(data.recipient);
          default:
            return Nothing;
        }
      });
  }
}
