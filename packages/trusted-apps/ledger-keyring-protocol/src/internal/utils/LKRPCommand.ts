import {
  bufferToHexaString,
  ByteArrayBuilder,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import { type Either, Just, Maybe, Nothing, Right } from "purify-ts";

import { type LKRPParsingError } from "@api/app-binder/Errors";
import {
  type LKRPCommandData,
  type UnsignedCommandData,
} from "@internal/models/LKRPCommandTypes";
import { CommandTags, GeneralTags } from "@internal/models/Tags";
import { type EncryptedPublishedKey } from "@internal/models/Types";

import { derivationPathAsBytes } from "./derivationPath";
import { TLVParser } from "./TLVParser";

export class LKRPCommand {
  private data: Maybe<Either<LKRPParsingError, LKRPCommandData>>;

  constructor(
    private bytes: Uint8Array,
    data?: LKRPCommandData,
  ) {
    this.data = data ? Just(Right(data)) : Nothing;
  }

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

      case CommandTags.AddMember:
        tlv
          .encodeInTLVFromAscii(GeneralTags.String, data.name)
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.publicKey)
          .encodeInTLVFromUInt32(GeneralTags.Int, data.permissions);
        break;

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
    return new LKRPCommand(
      new Uint8Array([data.type, bytes.length, ...bytes]),
      data,
    );
  }

  static bytesFromUnsignedData(data: UnsignedCommandData): Uint8Array {
    const tlv = new ByteArrayBuilder();
    switch (data.type) {
      case CommandTags.AddMember:
        tlv
          .encodeInTLVFromAscii(GeneralTags.String, data.name)
          .encodeInTLVFromBuffer(GeneralTags.PublicKey, data.publicKey)
          .encodeInTLVFromUInt32(GeneralTags.Int, data.permissions);
        break;

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
          return `  ${key}: ${value instanceof Uint8Array ? bufferToHexaString(value, false) : value}`;
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
