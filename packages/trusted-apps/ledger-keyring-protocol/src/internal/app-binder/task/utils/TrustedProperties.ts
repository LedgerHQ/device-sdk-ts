import { ByteArrayParser } from "@ledgerhq/device-management-kit";
import { Either, Left, Right } from "purify-ts";

import {
  type LKRPMissingDataError,
  LKRPParsingError,
} from "@api/app-binder/Errors";
import { required } from "@internal/utils/required";
import { TPTags } from "@internal/utils/TLVTags";

type EncryptedTPTag = Exclude<TPTags, TPTags.IV>;
type EncryptedTP = { tag: EncryptedTPTag; value: Uint8Array; tlv: Uint8Array };

export class TrustedProperties {
  private readonly parser: ByteArrayParser;
  private iv: Uint8Array | null = null;
  private encryptedProps: Map<EncryptedTPTag, EncryptedTP> | null = null;

  constructor(public readonly bytes: Uint8Array) {
    this.parser = new ByteArrayParser(bytes);
  }

  getIv(): Either<LKRPParsingError, Uint8Array> {
    if (!this.iv) {
      const field = this.parser.extractFieldTLVEncoded();
      if (!field || field.tag !== 0x00) {
        return Left(
          new LKRPParsingError("Invalid trusted property: missing IV"),
        );
      }

      this.iv = field.value;
    }
    return Right(this.iv);
  }

  getNewMember(): Either<LKRPParsingError | LKRPMissingDataError, Uint8Array> {
    return this.parseEncryptedProps().chain((props) =>
      required(
        props.get(TPTags.NEW_MEMBER)?.tlv,
        "Missing new member in trusted properties",
      ),
    );
  }

  parseEncryptedProps(): Either<
    LKRPParsingError,
    Map<EncryptedTPTag, EncryptedTP>
  > {
    return this.encryptedProps
      ? Right(this.encryptedProps)
      : this.getIv()
          .chain(() => Either.sequence(Array.from(parseTPs(this.parser))))
          .map((fields) => new Map(fields.map((field) => [field.tag, field])))
          .ifRight((props) => {
            this.encryptedProps = props;
          });
  }
}

function* parseTPs(
  parser: ByteArrayParser,
): Generator<Either<LKRPParsingError, EncryptedTP>> {
  while (true) {
    const field = parser.extractFieldTLVEncoded();
    if (!field) return;

    if (field.tag < TPTags.ISSUER || field.tag > TPTags.NEW_MEMBER) {
      yield Left(
        new LKRPParsingError(`Invalid trusted property tag: ${field.tag}`),
      );
      return;
    }
    yield Right(field);
  }
}
