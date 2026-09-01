// TLV assembly and transport for op 0x20 (Provide Contact), dispatched via the
// chunked-framing scheme shared with the other address-book ops.
//
// Reference: Address Book Final Specifications — Provide Contact. Tag order:
//   STRUCT_TYPE, STRUCT_VERSION, CONTACT_NAME, SCOPE, ACCOUNT_IDENTIFIER,
//   GROUP_HANDLE, CHAIN_ID (Ethereum only), BLOCKCHAIN_FAMILY, HMAC_PROOF,
//   HMAC_REST. No DERIVATION_PATH — that tag is Ledger-Account only.
//
// Device replies SW=0x9000 with empty data on success — no fields to extract.
import {
  ByteArrayBuilder,
  type CommandResult,
  type InternalApi,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type ProvideContactInput } from "@api/model/ProvideContact";
import { ProvideContactCommand } from "@internal/app-binder/command/ProvideContactCommand";
import {
  BLOCKCHAIN_FAMILY_BY_NAME,
  SUB_CMD_PROVIDE_CONTACT,
} from "@internal/app-binder/model/contactsConstants";
import { type ContactsErrorCodes } from "@internal/app-binder/model/contactsErrors";
import {
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvUInt8,
  STRUCT_TYPE_PROVIDE_CONTACT,
  STRUCT_VERSION_VALUE,
} from "@internal/app-binder/services/contactsTlvSerializer";
import { sendFramedContactsPayload } from "@internal/app-binder/services/sendFramedContactsPayload";

/**
 * Encode a matched contact as the PROVIDE CONTACT TLV payload, without the
 * chunk framing. Pure, so callers can build it while matching a recipient
 * against the address book, with no device involved.
 */
export function buildProvideContactPayload(
  input: ProvideContactInput,
): Uint8Array {
  const family =
    BLOCKCHAIN_FAMILY_BY_NAME[input.blockchainFamily.toLowerCase()];
  if (family === undefined) {
    throw new Error(`Unsupported blockchain family: ${input.blockchainFamily}`);
  }

  const builder = new ByteArrayBuilder();
  encodeTlvUInt8(
    builder,
    CONTACTS_TLV_TAG.STRUCT_TYPE,
    STRUCT_TYPE_PROVIDE_CONTACT,
  );
  encodeTlvUInt8(
    builder,
    CONTACTS_TLV_TAG.STRUCT_VERSION,
    STRUCT_VERSION_VALUE,
  );
  encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, input.contactName);
  encodeTlvAscii(builder, CONTACTS_TLV_TAG.SCOPE, input.scope);
  encodeTlvBuffer(
    builder,
    CONTACTS_TLV_TAG.ACCOUNT_IDENTIFIER,
    input.identifier,
  );
  encodeTlvBuffer(builder, CONTACTS_TLV_TAG.GROUP_HANDLE, input.groupHandle);
  if (input.chainId !== undefined) {
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, input.chainId);
  }
  encodeTlvUInt8(builder, CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY, family);
  encodeTlvBuffer(builder, CONTACTS_TLV_TAG.HMAC_PROOF, input.hmacProof);
  encodeTlvBuffer(builder, CONTACTS_TLV_TAG.HMAC_REST, input.hmacRest);

  return builder.build();
}

export type SendProvideContactPayloadArgs = {
  readonly payload: Uint8Array;
  readonly logger?: LoggerPublisherService;
};

export function sendProvideContactPayload(
  api: InternalApi,
  { payload, logger }: SendProvideContactPayloadArgs,
): Promise<CommandResult<void, ContactsErrorCodes>> {
  return sendFramedContactsPayload(api, {
    payload,
    p1: SUB_CMD_PROVIDE_CONTACT,
    makeCommand: (chunk, p2) => new ProvideContactCommand({ data: chunk, p2 }),
    logger,
    commandTag: "provideContact",
  }) as Promise<CommandResult<void, ContactsErrorCodes>>;
}
