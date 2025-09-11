import { ByteArrayParser } from "@ledgerhq/device-management-kit";
import { Either, Left, Right } from "purify-ts";

import { type LKRPMissingDataError, LKRPParsingError } from "@api/model/Errors";
import { TPTags } from "@internal/models/Tags";
import { required } from "@internal/utils/required";

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

  getIssuer(): Either<LKRPParsingError | LKRPMissingDataError, Uint8Array> {
    return this.parseEncryptedProps().chain((props) =>
      required(
        props.get(TPTags.ISSUER)?.value,
        "Missing issuer in trusted properties",
      ),
    );
  }

  getXPriv(): Either<LKRPParsingError | LKRPMissingDataError, Uint8Array> {
    return this.parseEncryptedProps().chain((props) =>
      required(
        props.get(TPTags.XPRIV)?.value,
        "Missing xpriv in trusted properties",
      ),
    );
  }

  getEphemeralPublicKey(): Either<
    LKRPParsingError | LKRPMissingDataError,
    Uint8Array
  > {
    return this.parseEncryptedProps().chain((props) =>
      required(
        props.get(TPTags.EPHEMERAL_PUBLIC_KEY)?.value,
        "Missing ephemeral public key in trusted properties",
      ),
    );
  }

  getCommandIv(): Either<LKRPParsingError | LKRPMissingDataError, Uint8Array> {
    return this.parseEncryptedProps().chain((props) =>
      required(
        props.get(TPTags.COMMAND_IV)?.value,
        "Missing command IV in trusted properties",
      ),
    );
  }

  getGroupKey(): Either<LKRPParsingError | LKRPMissingDataError, Uint8Array> {
    return this.parseEncryptedProps().chain((props) =>
      required(
        props.get(TPTags.GROUPKEY)?.value,
        "Missing group key in trusted properties",
      ),
    );
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
    yield Right(field);
  }
}
