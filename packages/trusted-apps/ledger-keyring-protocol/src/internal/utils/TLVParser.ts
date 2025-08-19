import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { LKRPParsingError } from "@api/model/Errors";
import { type LKRPBlockParsedData } from "@internal/models/LKRPBlockTypes";
import { type LKRPCommandData } from "@internal/models/LKRPCommandTypes";
import { CommandTags, GeneralTags } from "@internal/models/Tags";

import { derivationPathAsString } from "./derivationPath";
import { eitherSeqRecord } from "./eitherSeqRecord";
import { LKRPCommand } from "./LKRPCommand";

type ParserValue = Either<
  LKRPParsingError,
  | { tag: GeneralTags.Null; value: null }
  | { tag: GeneralTags.Int; value: number }
  | { tag: GeneralTags.Hash; value: Uint8Array }
  | { tag: GeneralTags.Signature; value: Uint8Array }
  | { tag: GeneralTags.String; value: string }
  | { tag: GeneralTags.Bytes; value: Uint8Array }
  | { tag: GeneralTags.PublicKey; value: Uint8Array }
  | { tag: CommandTags; value: Uint8Array }
  | {
      tag: Exclude<number, GeneralTags | CommandTags>;
      value: null | number | Uint8Array;
    }
>;

type Parser = Generator<ParserValue, ParserValue, void>;

const COMMAND_COUNT_LENGTH = 3;

export class TLVParser {
  private readonly bytes: Uint8Array;
  private readonly parser: Parser;
  private offset = 0;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.parser = this.parseTLV(bytes);
  }

  get state() {
    return {
      offset: this.offset,
      isDone: this.offset >= this.bytes.length,
    };
  }

  parse(): ParserValue {
    return this.parser.next().value;
  }

  tlvEncoded(
    fn: () => Either<LKRPParsingError, unknown>,
  ): Either<LKRPParsingError, Uint8Array> {
    const start = this.offset;
    return fn().map(() => this.bytes.slice(start, this.offset));
  }

  parseNull(): Either<LKRPParsingError, null> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Null
        ? Left(new LKRPParsingError("Expected null"))
        : Right(next.value),
    );
  }

  parseInt(): Either<LKRPParsingError, number> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Int
        ? Left(new LKRPParsingError("Expected a number"))
        : Right(next.value),
    );
  }

  parseHash(): Either<LKRPParsingError, Uint8Array> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Hash
        ? Left(new LKRPParsingError("Expected a hash"))
        : Right(next.value),
    );
  }

  parseSignature(): Either<LKRPParsingError, Uint8Array> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Signature
        ? Left(new LKRPParsingError("Expected a signature"))
        : Right(next.value),
    );
  }

  parseString(): Either<LKRPParsingError, string> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.String
        ? Left(new LKRPParsingError("Expected a string"))
        : Right(next.value),
    );
  }

  parseBytes(): Either<LKRPParsingError, Uint8Array> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Bytes
        ? Left(new LKRPParsingError("Expected bytes"))
        : Right(next.value),
    );
  }

  parsePublicKey(): Either<LKRPParsingError, Uint8Array> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.PublicKey
        ? Left(new LKRPParsingError("Expected a public key"))
        : Right(next.value),
    );
  }

  parseCommandBytes(): Either<LKRPParsingError, Uint8Array> {
    return this.parse().chain(({ tag, value }) =>
      tag < 0x10 || tag > 0x3f || !(value instanceof Uint8Array)
        ? Left(
            new LKRPParsingError(
              `Invalid command type: 0x${tag.toString(16).padStart(2, "0")}`,
            ),
          )
        : Right(value),
    );
  }

  // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#Commands
  parseCommandData(): Either<LKRPParsingError, LKRPCommandData> {
    const bytes = this.parseCommandBytes();
    const end = this.offset;

    return bytes
      .chain<LKRPParsingError, LKRPCommandData>((value) => {
        const type = value[0];
        this.offset -= value.length - 2; // Adjust offset to the start of the command
        switch (type) {
          // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#Seed-(0x10)
          case CommandTags.Seed:
            return eitherSeqRecord({
              type,
              topic: () => this.parseBytes(),
              protocolVersion: () => this.parseInt(),
              groupKey: () => this.parsePublicKey(),
              initializationVector: () => this.parseBytes(),
              encryptedXpriv: () => this.parseBytes(),
              ephemeralPublicKey: () => this.parsePublicKey(),
            });

          // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#AddMember-(0x11)
          case CommandTags.AddMember:
            return eitherSeqRecord({
              type,
              name: () => this.parseString(),
              publicKey: () => this.parsePublicKey(),
              permissions: () => this.parseInt(),
            });

          // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#PublishKey-(0x12)
          case CommandTags.PublishKey:
            return eitherSeqRecord({
              type,
              initializationVector: () => this.parseBytes(),
              encryptedXpriv: () => this.parseBytes(),
              recipient: () => this.parsePublicKey(),
              ephemeralPublicKey: () => this.parsePublicKey(),
            });

          // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#Derive-(0x15)
          case CommandTags.Derive:
            return eitherSeqRecord({
              type,
              path: () => this.parseBytes().map(derivationPathAsString),
              groupKey: () => this.parsePublicKey(),
              initializationVector: () => this.parseBytes(),
              encryptedXpriv: () => this.parseBytes(),
              ephemeralPublicKey: () => this.parsePublicKey(),
            });

          default:
            return Left(
              new LKRPParsingError(
                `Unsupported command type: 0x${type?.toString(16).padStart(2, "0")}`,
              ),
            );
        }
      })
      .chain((data) =>
        this.offset === end
          ? Right(data)
          : Left(new LKRPParsingError("Command was parsed incorrectly")),
      );
  }

  parseCommands(): Either<LKRPParsingError, LKRPCommand[]> {
    return this.parse()
      .chain((next) =>
        next.tag !== GeneralTags.Int
          ? Left(new LKRPParsingError("Expected a command count"))
          : Right(next.value),
      )
      .chain((count) => {
        const commands: LKRPCommand[] = [];
        for (let i = 0; i < count; i++) {
          const command = this.parseCommandBytes();
          if (command.isLeft()) return command;
          command.ifRight((value) => commands.push(new LKRPCommand(value)));
        }
        return Right(commands);
      });
  }

  // https://ledgerhq.atlassian.net/wiki/spaces/TA/pages/4105207815/ARCH+LKRP+-+v1+specifications#Block
  parseBlockData(): Either<LKRPParsingError, LKRPBlockParsedData> {
    const startOffset = this.offset;
    return this.parseInt().chain((_version) =>
      eitherSeqRecord({
        parent: () =>
          this.parseHash().map((buf) => bufferToHexaString(buf, false)),
        issuer: () => this.parsePublicKey(),
        header: () =>
          Right(
            this.bytes.slice(startOffset, this.offset + COMMAND_COUNT_LENGTH),
          ),
        commands: () => this.parseCommands(),
        signature: () => this.tlvEncoded(() => this.parseSignature()),
      }),
    );
  }

  private *parseTLV(bytes: Uint8Array): Parser {
    while (true) {
      const tag = bytes[this.offset];
      if (typeof tag === "undefined") {
        return Left(new LKRPParsingError("Unexpected end of TLV"));
      }
      this.offset++;
      const length = bytes[this.offset];
      if (typeof length === "undefined") {
        return Left(
          new LKRPParsingError("Invalid end of TLV, expected length"),
        );
      }
      this.offset++;
      const valueEnd = this.offset + length;
      const value = bytes.slice(this.offset, valueEnd);
      if (valueEnd > bytes.length) {
        return Left(new LKRPParsingError("Invalid end of TLV value"));
      }
      this.offset = valueEnd;

      switch (tag) {
        case GeneralTags.Null:
          yield length > 0
            ? Left(new LKRPParsingError("Invalid null length"))
            : Right({ tag, value: null });
          break;

        case GeneralTags.Int:
          {
            const dataView = new DataView(value.buffer);
            switch (value.length) {
              case 1:
                yield Right({ tag, value: dataView.getUint8(0) });
                break;
              case 2:
                yield Right({ tag, value: dataView.getUint16(0, false) }); // Big-endian
                break;
              case 4:
                yield Right({ tag, value: dataView.getUint32(0, false) }); // Big-endian
                break;
              default:
                yield Left(new LKRPParsingError("Unsupported integer length"));
            }
          }
          break;

        case GeneralTags.String:
          yield value.length === 0
            ? Left(new LKRPParsingError("Empty string value"))
            : Right({ tag, value: new TextDecoder().decode(value) });
          break;

        case GeneralTags.Hash:
        case GeneralTags.Signature:
        case GeneralTags.Bytes:
        case GeneralTags.PublicKey:
          yield Right({ tag, value });
          break;

        default:
          yield Right({ tag, value: new Uint8Array([tag, length, ...value]) });
          break;
      }
    }
  }
}
