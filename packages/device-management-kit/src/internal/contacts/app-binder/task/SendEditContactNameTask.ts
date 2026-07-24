// Builds the TLV payload for op 4 (Edit Contact Name / Rename Contact) and
// dispatches it via EditContactNameCommand. Single APDU regardless of N
// entries on the contact.
//
// Reference:
// ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md
//   prepare_edit_contact_name → tag order is STRUCT_TYPE, STRUCT_VERSION,
//   CONTACT_NAME (new), PREVIOUS_CONTACT_NAME (old), GROUP_HANDLE,
//   DERIVATION_PATH, HMAC_PROOF.
import { ByteArrayBuilder } from "@api/apdu/utils/ByteArrayBuilder";
import { InvalidStatusWordError } from "@api/command/Errors";
import { type CommandResult } from "@api/command/model/CommandResult";
import { type ContactsErrorCodes } from "@api/contacts/ContactsErrors";
import { type RenameContactArgs } from "@api/contacts/model/RenameContactArgs";
import {
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvHex,
  encodeTlvUInt8,
  packDerivationPath,
  STRUCT_TYPE_EDIT_CONTACT_NAME,
  STRUCT_VERSION_VALUE,
} from "@api/contacts/utils/contactsTlvSerializer";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DmkResultFactory } from "@api/model/DmkResult";
import {
  EditContactNameCommand,
  type EditContactNameCommandResponse,
} from "@internal/contacts/app-binder/command/EditContactNameCommand";

const APDU_DATA_MAX_BYTES = 255;

type SendEditContactNameTaskArgs = RenameContactArgs & {
  readonly logger: LoggerPublisherService;
};

export class SendEditContactNameTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendEditContactNameTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<
    CommandResult<EditContactNameCommandResponse, ContactsErrorCodes>
  > {
    const payload = this.buildPayload(this.args);

    this._logger.info("[run] payload built", {
      tag: "SendEditContactNameTask",
      data: {
        oldName: this.args.oldName,
        newName: this.args.newName,
        derivationPath: this.args.derivationPath,
        groupHandleHex: this.args.groupHandleHex,
        hmacProofLen: this.args.hmacProofHex.length / 2,
        payloadLen: payload.length,
      },
    });

    if (payload.length > APDU_DATA_MAX_BYTES) {
      this._logger.error("[run] Payload exceeds APDU data limit", {
        tag: "SendEditContactNameTask",
        data: { length: payload.length, max: APDU_DATA_MAX_BYTES },
      });
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          `Edit contact name payload is ${payload.length} bytes (max ${APDU_DATA_MAX_BYTES}).`,
        ),
      });
    }

    this._logger.debug("[send] dispatching EditContactNameCommand", {
      tag: "editContactName",
      data: { payloadLen: payload.length },
    });

    return this.api.sendCommand(new EditContactNameCommand({ data: payload }));
  }

  private buildPayload(args: SendEditContactNameTaskArgs): Uint8Array {
    const segments = splitPath(args.derivationPath);
    const pathBytes = packDerivationPath(segments);

    const builder = new ByteArrayBuilder();
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_TYPE,
      STRUCT_TYPE_EDIT_CONTACT_NAME,
    );
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_VERSION,
      STRUCT_VERSION_VALUE,
    );
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.newName);
    encodeTlvAscii(
      builder,
      CONTACTS_TLV_TAG.PREVIOUS_CONTACT_NAME,
      args.oldName,
    );
    encodeTlvHex(builder, CONTACTS_TLV_TAG.GROUP_HANDLE, args.groupHandleHex);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.HMAC_PROOF, args.hmacProofHex);

    return builder.build();
  }
}

// Mirror of DerivationPathUtils.splitPath from signer-utils — kept inline
// here because DMK-core shouldn't depend on the signer-utils package.
// Accepts both "m/44'/60'/..." and "44'/60'/..." forms.
function splitPath(path: string): number[] {
  const stripped =
    path.startsWith("m/") || path.startsWith("M/") ? path.slice(2) : path;
  return stripped.split("/").map((segment) => {
    const hardened = segment.endsWith("'");
    const raw = hardened ? segment.slice(0, -1) : segment;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`invalid BIP32 segment: ${segment}`);
    }
    return hardened ? n + 0x80000000 : n;
  });
}
