import { type Either, Left, Right } from "purify-ts";

import { type CommandTags, GeneralTags } from "./TLVTags";

type ParserValue = Either<
  Error,
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

  parseNull(): Either<Error, null> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Null
        ? Left(new Error("Expected null"))
        : Right(next.value),
    );
  }

  parseInt(): Either<Error, number> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Int
        ? Left(new Error("Expected a number"))
        : Right(next.value),
    );
  }

  parseHash(): Either<Error, Uint8Array> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Hash
        ? Left(new Error("Expected a hash"))
        : Right(next.value),
    );
  }

  parseSignature(): Either<Error, Uint8Array> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Signature
        ? Left(new Error("Expected a signature"))
        : Right(next.value),
    );
  }

  parseString(): Either<Error, string> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.String
        ? Left(new Error("Expected a string"))
        : Right(next.value),
    );
  }

  parseBytes(): Either<Error, Uint8Array> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.Bytes
        ? Left(new Error("Expected bytes"))
        : Right(next.value),
    );
  }

  parsePublicKey(): Either<Error, Uint8Array> {
    return this.parse().chain((next) =>
      next.tag !== GeneralTags.PublicKey
        ? Left(new Error("Expected a public key"))
        : Right(next.value),
    );
  }

  private *parseTLV(bytes: Uint8Array): Parser {
    while (true) {
      const tag = bytes[this.offset];
      if (typeof tag === "undefined") {
        return Left(
          new Error("No more data to parse at offset " + this.offset),
        );
      }
      this.offset++;
      const length = bytes[this.offset];
      if (typeof length === "undefined") {
        return Left(
          new Error(
            "Invalid end of TLV, expected length at offset " + this.offset,
          ),
        );
      }
      this.offset++;
      const valueEnd = this.offset + length;
      const value = bytes.slice(this.offset, valueEnd);
      if (valueEnd > bytes.length) {
        return Left(
          new Error("Invalid end of TLV value at offset " + this.offset),
        );
      }
      this.offset = valueEnd;

      switch (tag) {
        case GeneralTags.Null:
          yield length > 0
            ? Left(new Error("Invalid null length"))
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
                yield Left(new Error("Unsupported integer length"));
            }
          }
          break;

        case GeneralTags.String:
          yield value.length === 0
            ? Left(new Error("Empty string value"))
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
