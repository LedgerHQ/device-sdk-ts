import {
  bufferToHexaString,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Either, Just, type Maybe, Nothing, Right } from "purify-ts";

import { type LKRPParsingError } from "@api/app-binder/Errors";
import {
  type LKRPBlockData,
  type LKRPBlockParsedData,
} from "@internal/models/LKRPBlockTypes";

import { CryptoUtils } from "./crypto";
import { TLVBuilder } from "./TLVBuilder";
import { TLVParser } from "./TLVParser";

export class LKRPBlock {
  private hashValue: Maybe<string> = Nothing; // Cache hash value for performance
  private data: Maybe<Either<LKRPParsingError, LKRPBlockParsedData>>;

  public constructor(
    private readonly bytes: Uint8Array,
    data?: LKRPBlockParsedData,
  ) {
    this.data = data ? Just(Right(data)) : Nothing;
  }

  static fromHex(hex: string): LKRPBlock {
    return new LKRPBlock(hexaStringToBuffer(hex) ?? new Uint8Array());
  }

  static fromData(data: LKRPBlockData): LKRPBlock {
    const builder = new TLVBuilder()
      .addInt(1, 1) // Version 1
      .addHash(hexaStringToBuffer(data.parent) ?? new Uint8Array())
      .addPublicKey(data.issuer)
      .addInt(data.commands.length, 1);

    const header = builder.build();

    data.commands.forEach((cmd) => builder.push(cmd.toU8A()));

    const sigStart = builder.build().length;
    const bytes = builder.addSignature(data.signature).build();
    const signature = bytes.slice(sigStart, bytes.length);

    return new LKRPBlock(bytes, { ...data, header, signature });
  }

  toString(): string {
    return bufferToHexaString(this.bytes).slice(2);
  }

  toU8A(): Uint8Array {
    return this.bytes;
  }

  parse(): Either<LKRPParsingError, LKRPBlockParsedData> {
    return this.data.orDefaultLazy(() => {
      const data = new TLVParser(this.bytes).parseBlockData();
      this.data = Just(data);
      return data;
    });
  }

  toHuman(): Either<LKRPParsingError, string> {
    return this.parse()
      .chain((data) =>
        Either.sequence(data.commands.map((cmd) => cmd.toHuman())).map(
          (commands) => ({ ...data, commands }),
        ),
      )
      .map((data) =>
        [
          `Parent: ${data.parent}`,
          `Issuer: ${bufferToHexaString(data.issuer).slice(2)}`,
          `Commands:${data.commands
            .flatMap((cmd) => cmd.split("\n").map((l) => `\n  ${l}`))
            .join("")}`,
          `Signature: ${bufferToHexaString(data.signature.slice(2)).slice(2)}`,
        ].join("\n"),
      );
  }

  hash(): string {
    return this.hashValue.orDefaultLazy(() => {
      const hashValue = CryptoUtils.hash(this.bytes);
      return bufferToHexaString(hashValue).slice(2);
    });
  }
}
