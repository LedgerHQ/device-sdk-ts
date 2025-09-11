import {
  bufferToHexaString,
  ByteArrayBuilder,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { sha256 } from "@noble/hashes/sha256";
import { Either, Just, type Maybe, Nothing, Right } from "purify-ts";

import { type LKRPParsingError } from "@api/model/Errors";
import {
  type LKRPBlockData,
  type LKRPBlockParsedData,
  type LKRPParsedTlvBlock,
} from "@internal/models/LKRPBlockTypes";
import { GeneralTags } from "@internal/models/Tags";

import { TLVParser } from "./TLVParser";

export class LKRPBlock {
  private hashValue: Maybe<string> = Nothing; // Cache hash value for performance

  public constructor(
    private readonly bytes: Uint8Array,
    private parsed: Maybe<
      Either<LKRPParsingError, LKRPParsedTlvBlock>
    > = Nothing,
  ) {}

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

    return new LKRPBlock(bytes);
  }

  toString(): string {
    return bufferToHexaString(this.bytes, false);
  }

  toU8A(): Uint8Array {
    return this.bytes;
  }

  parse(): Either<LKRPParsingError, LKRPBlockParsedData> {
    return this._parse().map(({ bytes, data }) => ({
      header: bytes.slice(data.version.start, data.commandsCount.end),
      parent: data.parent.value,
      issuer: data.issuer.value,
      commands: data.commands.value,
      signature: bytes.slice(data.signature.start, data.signature.end), // Includes the tlv tag and length
    }));
  }

  private _parse(): Either<LKRPParsingError, LKRPParsedTlvBlock> {
    return this.parsed.orDefaultLazy(() => {
      const parsed = new TLVParser(this.bytes).parseBlockData();
      this.parsed = Just(parsed);
      return parsed;
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
      const hashValue = sha256(this.bytes);
      return bufferToHexaString(hashValue, false);
    });
  }
}
