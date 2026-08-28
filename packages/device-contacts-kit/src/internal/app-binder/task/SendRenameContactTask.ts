// Builds the TLV payload for the Rename Contact (EDIT CONTACT NAME) op and
// dispatches it via the chunked-framing scheme shared with the other
// address-book ops (2-byte BE total length + <=255B chunks). Rename is an
// OS/dashboard command (CLA 0xE0 / INS 0x2E) — the caller runs this task after
// navigating to the dashboard (GoToDashboardDeviceAction), never inside an app.
//
// The device rotates the contact-level hmac_name and returns the fresh proof on
// the final chunk; per-entry hmac_rest values are untouched (they bind
// gid|scope|id|family|chain_id, never the name), so a single APDU regardless of
// the contact's entry count.
//
// Reference: Address Book Final Specifications — Edit Contact Name. Tag order:
//   STRUCT_TYPE, STRUCT_VERSION, CONTACT_NAME (new), PREVIOUS_CONTACT_NAME
//   (old), GROUP_HANDLE, DERIVATION_PATH, HMAC_PROOF.
import {
  ByteArrayBuilder,
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { RenameContactCommand } from "@internal/app-binder/command/RenameContactCommand";
import { RENAME_CONTACT_P1 } from "@internal/app-binder/model/contactsConstants";
import { type ContactsErrorCodes } from "@internal/app-binder/model/contactsErrors";
import {
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvUInt8,
  packDerivationPath,
  STRUCT_TYPE_EDIT_CONTACT_NAME,
  STRUCT_VERSION_VALUE,
} from "@internal/app-binder/services/contactsTlvSerializer";
import { sendFramedContactsPayload } from "@internal/app-binder/services/sendFramedContactsPayload";

export type RenameContactProof = {
  readonly hmacProof: Uint8Array;
};

export type SendRenameContactTaskArgs = {
  readonly previousContactName: string;
  readonly newContactName: string;
  readonly groupHandle: Uint8Array;
  readonly hmacProof: Uint8Array;
  readonly logger?: LoggerPublisherService;
};

export class SendRenameContactTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendRenameContactTaskArgs,
  ) {}

  async run(): Promise<CommandResult<RenameContactProof, ContactsErrorCodes>> {
    const payload = this.buildPayload(this.args);

    const result = (await sendFramedContactsPayload(this.api, {
      payload,
      p1: RENAME_CONTACT_P1,
      makeCommand: (chunk, p2) => new RenameContactCommand({ data: chunk, p2 }),
      logger: this.args.logger,
      commandTag: "SendRenameContactTask",
    })) as CommandResult<
      { readonly hmacProof?: Uint8Array },
      ContactsErrorCodes
    >;

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    const { hmacProof } = result.data;
    if (!hmacProof) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "RenameContact final-chunk response did not carry hmac_name",
        ),
      });
    }
    return DmkResultFactory({ data: { hmacProof } });
  }

  private buildPayload(args: SendRenameContactTaskArgs): Uint8Array {
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
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.newContactName);
    encodeTlvAscii(
      builder,
      CONTACTS_TLV_TAG.PREVIOUS_CONTACT_NAME,
      args.previousContactName,
    );
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.GROUP_HANDLE, args.groupHandle);
    // The Ethereum app requires DERIVATION_PATH on Edit Contact Name (0x6a80
    // without it), same as Register Identity. Default m/44'/60'/0'/0/0.
    encodeTlvBuffer(
      builder,
      CONTACTS_TLV_TAG.DERIVATION_PATH,
      packDerivationPath([0x8000002c, 0x8000003c, 0x80000000, 0, 0]),
    );
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.HMAC_PROOF, args.hmacProof);

    return builder.build();
  }
}
