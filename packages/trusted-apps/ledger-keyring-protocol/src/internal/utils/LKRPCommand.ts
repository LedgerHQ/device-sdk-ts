import { type Either, Just, Maybe, Nothing, Right } from "purify-ts";

import { type LKRPParsingError } from "@api/app-binder/Errors";

import { derivationPathAsBytes } from "./derivationPath";
import { bytesToHex, hexToBytes } from "./hex";
import { TLVBuilder } from "./TLVBuilder";
import { TLVParser } from "./TLVParser";
import { CommandTags } from "./TLVTags";
import {
  type EncryptedPublishedKey,
  type LKRPCommandData,
  type UnsignedCommandData,
} from "./types";

export class LKRPCommand {
  private data: Maybe<Either<LKRPParsingError, LKRPCommandData>>;

  constructor(
    private bytes: Uint8Array,
    data?: LKRPCommandData,
  ) {
    this.data = data ? Just(Right(data)) : Nothing;
  }

  static fromHex(hex: string): LKRPCommand {
    return new LKRPCommand(hexToBytes(hex));
  }

  static fromData(data: LKRPCommandData): LKRPCommand {
    const tlv = new TLVBuilder();
    switch (data.type) {
      case CommandTags.Seed:
        tlv
          .addBytes(data.topic)
          .addInt(data.protocolVersion, 2)
          .addPublicKey(data.groupKey)
          .addBytes(data.initializationVector)
          .addBytes(data.encryptedXpriv)
          .addPublicKey(data.ephemeralPublicKey);
        break;

      case CommandTags.AddMember:
        tlv
          .addString(data.name)
          .addPublicKey(data.publicKey)
          .addInt(data.permissions, 4);
        break;

      case CommandTags.PublishKey:
        tlv
          .addBytes(data.initializationVector)
          .addBytes(data.encryptedXpriv)
          .addPublicKey(data.recipient)
          .addPublicKey(data.ephemeralPublicKey);
        break;

      case CommandTags.Derive:
        tlv
          .addBytes(derivationPathAsBytes(data.path))
          .addPublicKey(data.groupKey)
          .addBytes(data.initializationVector)
          .addBytes(data.encryptedXpriv)
          .addPublicKey(data.ephemeralPublicKey);
        break;
    }

    const bytes = tlv.build();
    return new LKRPCommand(
      new Uint8Array([data.type, bytes.length, ...bytes]),
      data,
    );
  }

  static bytesFromUnsignedData(data: UnsignedCommandData): Uint8Array {
    const tlv = new TLVBuilder();
    switch (data.type) {
      case CommandTags.AddMember:
        tlv
          .addString(data.name)
          .addPublicKey(data.publicKey)
          .addInt(data.permissions, 4);
        break;

      case CommandTags.PublishKey:
        tlv.addBytes(new Uint8Array()); // Empty IV
        tlv.addBytes(new Uint8Array()); // Empty encryptedXpriv
        tlv.addPublicKey(data.recipient);
        tlv.addPublicKey(new Uint8Array()); // Empty ephemeralPublicKey
        break;

      case CommandTags.Derive:
        tlv.addBytes(derivationPathAsBytes(data.path));
        break;
    }

    const bytes = tlv.build();
    return new Uint8Array([data.type, bytes.length, ...bytes]);
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
          .map(bytesToHex);

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
