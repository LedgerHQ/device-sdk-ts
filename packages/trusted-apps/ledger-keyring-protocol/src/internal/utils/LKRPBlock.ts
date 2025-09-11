import {
  bufferToHexaString,
  ByteArrayBuilder,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { Either, Just, type Maybe, Nothing, Right } from "purify-ts";

import { type CryptoService, HashAlgo } from "@api/crypto/CryptoService";
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
    private readonly cryptoService: CryptoService,
    private readonly bytes: Uint8Array,
    private parsed: Maybe<
      Either<LKRPParsingError, LKRPParsedTlvBlock>
    > = Nothing,
  ) {}

  static fromHex(cryptoService: CryptoService, hex: string): LKRPBlock {
    return new LKRPBlock(
      cryptoService,
      hexaStringToBuffer(hex) ?? new Uint8Array(),
    );
  }

  static fromParser(
    cryptoService: CryptoService,
    parser: TLVParser,
  ): Either<LKRPParsingError, LKRPBlock> {
    return parser.parseBlockData().map((parsed) => {
      const bytes = parsed.bytes.slice(
        parsed.data.version.start,
        parsed.data.signature.end,
      );
      return new LKRPBlock(cryptoService, bytes, Just(Right(parsed)));
    });
  }

  static fromData(
    cryptoService: CryptoService,
    data: LKRPBlockData,
  ): LKRPBlock {
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

    return new LKRPBlock(cryptoService, bytes);
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
  verifySignature(): Either<LKRPParsingError, boolean> {
    return this._parse().chain((parsed) => {
      const unsignedBlock = parsed.bytes.slice(
        parsed.data.version.start,
        parsed.data.signature.start,
      );
      const unsignedBlockHash = this.cryptoService.hash(
        unsignedBlock,
        HashAlgo.SHA256,
      );
      return this.cryptoService.verify(
        unsignedBlockHash,
        parsed.data.signature.value,
        parsed.data.issuer.value,
      );
    });
  }

  hash(): string {
    return this.hashValue.orDefaultLazy(() => {
      const hashValue = this.cryptoService.hash(this.bytes, HashAlgo.SHA256);
      return bufferToHexaString(hashValue, false);
    });
  }
}
