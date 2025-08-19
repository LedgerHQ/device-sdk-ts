import {
  bufferToHexaString,
  ByteArrayBuilder,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Either, Just, type Maybe, Nothing, Right } from "purify-ts";

import { type LKRPParsingError } from "@api/model/Errors";
import {
  type LKRPBlockData,
  type LKRPBlockParsedData,
} from "@internal/models/LKRPBlockTypes";
import { GeneralTags } from "@internal/models/Tags";

import { CryptoUtils } from "./crypto";
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
    const header = new ByteArrayBuilder()
      .encodeInTLVFromUInt8(GeneralTags.Int, 1) // Version 1
      .encodeInTLVFromHexa(GeneralTags.Hash, data.parent)
      .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.issuer)
      .encodeInTLVFromUInt8(GeneralTags.Int, data.commands.length)
      .build();

    const commandsBuilder = new ByteArrayBuilder();
    data.commands.forEach((cmd) =>
      commandsBuilder.addBufferToData(cmd.toU8A()),
    );
    const commands = commandsBuilder.build();

    const signature = new ByteArrayBuilder()
      .encodeInTLVFromBuffer(GeneralTags.Signature, data.signature)
      .build();

    const bytes = new ByteArrayBuilder()
      .addBufferToData(header)
      .addBufferToData(commands)
      .addBufferToData(signature)
      .build();

    return new LKRPBlock(bytes, { ...data, header, signature });
  }

  toString(): string {
    return bufferToHexaString(this.bytes, false);
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
          `Issuer: ${bufferToHexaString(data.issuer, false)}`,
          `Commands:${data.commands
            .flatMap((cmd) => cmd.split("\n").map((l) => `\n  ${l}`))
            .join("")}`,
          `Signature: ${bufferToHexaString(data.signature.slice(2), false)}`,
        ].join("\n"),
      );
  }

  hash(): string {
    return this.hashValue.orDefaultLazy(() => {
      const hashValue = CryptoUtils.hash(this.bytes);
      return bufferToHexaString(hashValue, false);
    });
  }
}
