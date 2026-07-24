// Builds the TLV payload for the Edit Contact Name (rename) op and dispatches
// it via the chunked-framing scheme. The rename is an OS/dashboard command
// (CLA 0xE0 / INS 0x2E) — the caller runs this task inside
// CallTaskOnDashboardDeviceAction, which closes any running app first.
//
// Reference:
// ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md §5.2
//   edit contact name → tag order STRUCT_TYPE, STRUCT_VERSION,
//   CONTACT_NAME (new), PREVIOUS_CONTACT_NAME (old), GROUP_HANDLE,
//   DERIVATION_PATH, HMAC_PROOF. Response: struct_type(0x2e) + rotated
//   hmac_name(32).
import { ByteArrayBuilder } from "@api/apdu/utils/ByteArrayBuilder";
import { InvalidStatusWordError } from "@api/command/Errors";
import { type CommandResult } from "@api/command/model/CommandResult";
import {
  type RenameContactArgs,
  type RenameContactResult,
} from "@api/contacts/model/RenameContactArgs";
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
import { sendFramedContactsPayload } from "@api/contacts/utils/sendFramedContactsPayload";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DmkResultFactory, isSuccessDmkResult } from "@api/model/DmkResult";
import { EditContactNameCommand } from "@internal/contacts/app-binder/command/EditContactNameCommand";

// P1 is 0x00 for the OS edit-contact-name command (not a sub-command byte).
const EDIT_CONTACT_NAME_P1 = 0x00;

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

  async run(): Promise<CommandResult<RenameContactResult>> {
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

    const result = await sendFramedContactsPayload(this.api, {
      payload,
      p1: EDIT_CONTACT_NAME_P1,
      makeCommand: (chunk, p2) =>
        new EditContactNameCommand({ data: chunk, p2 }),
      logger: this._logger,
      commandTag: "editContactName",
    });

    if (!isSuccessDmkResult(result)) {
      return result;
    }
    // The final chunk's response carries the rotated hmac_name; if it's
    // missing, the device returned a malformed structure.
    if (!result.data.hmacNameHex) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "EditContactName final-chunk response did not carry hmac_name",
        ),
      });
    }
    return DmkResultFactory({
      data: { hmacNameHex: result.data.hmacNameHex },
    });
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
