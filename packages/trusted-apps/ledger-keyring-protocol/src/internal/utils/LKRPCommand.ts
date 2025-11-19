import {
  bufferToHexaString,
  ByteArrayBuilder,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { type Either, Just, Maybe, Nothing } from "purify-ts";

import { type LKRPParsingError } from "@api/model/Errors";
import {
  type LKRPCommandData,
  type LKRPParsedTlvCommand,
  type UnsignedCommandData,
} from "@internal/models/LKRPCommandTypes";
import { CommandTags, GeneralTags } from "@internal/models/Tags";
import { type EncryptedPublishedKey } from "@internal/models/Types";

import { derivationPathAsBytes } from "./derivationPath";
import { TLVParser } from "./TLVParser";

export class LKRPCommand {
  private data: Maybe<Either<LKRPParsingError, LKRPParsedTlvCommand>> = Nothing;

  constructor(private bytes: Uint8Array) {}

  static fromHex(hex: string): LKRPCommand {
    return new LKRPCommand(hexaStringToBuffer(hex) ?? new Uint8Array());
  }

  static fromData(data: LKRPCommandData): LKRPCommand {
    const tlv = new ByteArrayBuilder();
    switch (data.type) {
      case CommandTags.Seed:
        tlv
          .encodeInTLVFromBuffer(GeneralTags.Bytes, data.topic)
          .encodeInTLVFromUInt16(GeneralTags.Int, data.protocolVersion)
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.groupKey)
          .encodeInTLVFromBuffer(GeneralTags.Bytes, data.initializationVector)
          .encodeInTLVFromBuffer(GeneralTags.Bytes, data.encryptedXpriv)
          .encodeInTLVFromBuffer(
            GeneralTags.PublicKey,
            data.ephemeralPublicKey,
          );
        break;

      case CommandTags.AddMember: {
        const permissions = new ArrayBuffer(4);
        new DataView(permissions).setUint32(0, data.permissions);
        tlv
          .encodeInTLVFromAscii(GeneralTags.String, data.name)
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.publicKey)
          .encodeInTLVFromBuffer(GeneralTags.Int, new Uint8Array(permissions));
        break;
      }

      case CommandTags.PublishKey:
        tlv
          .encodeInTLVFromBuffer(GeneralTags.Bytes, data.initializationVector)
          .encodeInTLVFromBuffer(GeneralTags.Bytes, data.encryptedXpriv)
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.recipient)
          .encodeInTLVFromBuffer(
            GeneralTags.PublicKey,
            data.ephemeralPublicKey,
          );
        break;

      case CommandTags.Derive:
        tlv
          .encodeInTLVFromBuffer(
            GeneralTags.Bytes,
            derivationPathAsBytes(data.path),
          )
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.groupKey)
          .encodeInTLVFromBuffer(GeneralTags.Bytes, data.initializationVector)
          .encodeInTLVFromBuffer(GeneralTags.Bytes, data.encryptedXpriv)
          .encodeInTLVFromBuffer(
            GeneralTags.PublicKey,
            data.ephemeralPublicKey,
          );
        break;
    }

    const bytes = tlv.build();
    return new LKRPCommand(new Uint8Array([data.type, bytes.length, ...bytes]));
  }

  static bytesFromUnsignedData(data: UnsignedCommandData): Uint8Array {
    const tlv = new ByteArrayBuilder();
    switch (data.type) {
      case CommandTags.AddMember: {
        // NOTE: encode the permission bytes array with DataView because
        // ByteArrayBuilder.encodeInTLVFromUInt32 doesn't seem to work with negative numbers
        // ByteArrayBuilder.add32BitIntToData doesn't seem to work with number > 0x7fffffff
        const permissions = new ArrayBuffer(4);
        new DataView(permissions).setUint32(0, data.permissions);
        tlv
          .encodeInTLVFromAscii(GeneralTags.String, data.name)
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.publicKey)
          .encodeInTLVFromBuffer(GeneralTags.Int, new Uint8Array(permissions));
        break;
      }

      case CommandTags.PublishKey:
        tlv
          .encodeInTLVFromBuffer(GeneralTags.Bytes, new Uint8Array()) // Empty IV
          .encodeInTLVFromBuffer(GeneralTags.Bytes, new Uint8Array()) // Empty encryptedXpriv
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.recipient)
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, new Uint8Array()); // Empty ephemeralPublicKey
        break;

      case CommandTags.Derive:
        tlv.encodeInTLVFromBuffer(
          GeneralTags.Bytes,
          derivationPathAsBytes(data.path),
        );
        break;
    }

    const bytes = tlv.build();
    return new Uint8Array([data.type, bytes.length, ...bytes]);
  }

  toString(): string {
    return bufferToHexaString(this.bytes, false);
  }

  toU8A(): Uint8Array {
    return this.bytes;
  }

  parse(): Either<LKRPParsingError, LKRPCommandData> {
    return this._parse().map(
      (data) =>
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, v.value]),
        ) as LKRPCommandData,
    );
  }

  private _parse(): Either<LKRPParsingError, LKRPParsedTlvCommand> {
    return this.data.orDefaultLazy(() => {
      const data = new TLVParser(this.bytes).parseCommandData();
      this.data = Just(data);
      return data;
    });
  }

  toHuman(): Either<string, string> {
    return this.parse()
      .mapLeft(
        (err) => err.originalError?.toString() ?? "Unknown parsing error",
      )
      .map((data) =>
        Object.entries(data)
          .map(([key, value]) => {
            switch (typeof value) {
              case "number": {
                const str = value.toString(16);
                const formatted = str.length % 2 === 0 ? str : `0${str}`;
                if (key === "type") {
                  return `${CommandTags[value]}(0x${value?.toString(16).padStart(2, "0")}):`;
                }
                return `  ${key}(${formatted.length / 2}): 0x${formatted}`;
              }
              case "object":
                if (value instanceof Uint8Array) {
                  return `  ${key}(${value.length}): ${bufferToHexaString(value, false)}`;
                }
                break;
            }
            return `  ${key}: "${value}"`;
          })
          .join("\n"),
      );
  }

  getPublicKey(): Maybe<string> {
    switch (this.bytes[0]) {
      case CommandTags.AddMember:
      case CommandTags.PublishKey:
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
          })
          .map((str) => bufferToHexaString(str, false));

      default:
        return Nothing;
    }
  }

  getEncryptedPublishedKey(): Maybe<EncryptedPublishedKey> {
    switch (this.bytes[0]) {
      case CommandTags.Seed:
      case CommandTags.Derive:
      case CommandTags.PublishKey:
        return this.parse()
          .toMaybe()
          .chain((data) => {
            switch (data.type) {
              case CommandTags.Seed:
              case CommandTags.Derive:
              case CommandTags.PublishKey:
                return Maybe.of({ ...data });
              default:
                return Nothing;
            }
          });
      default:
        return Nothing;
    }
  }
}
