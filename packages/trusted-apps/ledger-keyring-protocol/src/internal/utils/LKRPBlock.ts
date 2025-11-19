import {
  bufferToHexaString,
  ByteArrayBuilder,
  hexaStringToBuffer,
  numToHexaString,
} from "@ledgerhq/device-management-kit";
import { Either, Just, Left, type Maybe, Nothing, Right } from "purify-ts";

import { type CryptoService, HashAlgo } from "@api/crypto/CryptoService";
import { LKRPParsingError } from "@api/model/Errors";
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

  toHuman(): Either<string, string> {
    return this._parse()
      .mapLeft(
        (err) => err.originalError?.toString() ?? "Unknown parsing error",
      )
      .chain(({ data }) => {
        const hash = this.hash();
        const hex = this.toString();
        const commands = data.commands.value.map((cmd) => cmd.toHuman());
        const sig = Either.encase(() =>
          this.cryptoService.decodeSignature(data.signature.value),
        ).mapLeft((err) => [
          String("originalError" in err ? err.originalError : String(err)),
          `Invalid Signature: ${bufferToHexaString(data.signature.value, false)}`,
        ]);
        const isVerified = this.verifySignature().mapLeft(() => false);

        return Either.sequence(commands)
          .mapLeft(() => commands.map((cmd) => cmd.mapLeft(String).extract()))
          .bimap(stringifyData, stringifyData)
          .chain((str) => (isVerified.isRight() ? Right(str) : Left(str)));

        function stringifyData(cmds: string[]): string {
          return [
            `(isVerified: ${isVerified.extract()}, Hash: ${hash})`,
            indentLines([
              `Hex: ${hex}`,
              `data:${indentLines([
                `Parent(${data.parent.value.length / 2}): ${data.parent.value}`,
                `Issuer(${data.issuer.value.length}): ${bufferToHexaString(data.issuer.value, false)}`,
                `Commands(${cmds.length}):${indentLines(cmds)}`,
                `Signature${indentLines(
                  sig
                    .map(({ prefix, r, s }) => [
                      `${numToHexaString(prefix.tag)}(${prefix.len})`,
                      `${numToHexaString(r.tag)}(${r.len}): ${bufferToHexaString(r.value, false)}`,
                      `${numToHexaString(s.tag)}(${s.len}): ${bufferToHexaString(s.value, false)}`,
                    ])
                    .extract(),
                )}`,
              ])}`,
            ]),
          ].join("");
        }
        function indentLines(strs: string[]): string {
          return strs
            .flatMap((str) => str.split("\n").map((l) => `\n  ${l}`))
            .join("");
        }
      });
  }

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
      return Either.encase(() =>
        this.cryptoService.verify(
          unsignedBlockHash,
          parsed.data.signature.value,
          parsed.data.issuer.value,
        ),
      ).mapLeft(
        (error) =>
          new LKRPParsingError(
            String(
              "originalError" in error ? error.originalError : String(error),
            ),
          ),
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
