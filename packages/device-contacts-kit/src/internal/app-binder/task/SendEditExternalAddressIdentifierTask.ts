// Builds the op-3 (Edit Identifier) TLV and dispatches it via the shared
// chunked framing; the device returns struct_type + hmac_rest on the final
// chunk. Tag order: STRUCT_TYPE, STRUCT_VERSION, CONTACT_NAME, SCOPE,
// ACCOUNT_IDENTIFIER (new), PREVIOUS_IDENTIFIER (old), GROUP_HANDLE,
// CHAIN_ID (Ethereum only), HMAC_PROOF, HMAC_REST (old), BLOCKCHAIN_FAMILY.
// No DERIVATION_PATH: external-address ops carry no path — the current Ethereum
// app rejects the tag (0x6a80); it is Ledger-Account only (DSDK-1465).
// Reference: Address Book Final Specifications — Edit Identifier.
import {
  ByteArrayBuilder,
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { EditExternalAddressIdentifierCommand } from "@internal/app-binder/command/EditExternalAddressIdentifierCommand";
import {
  BLOCKCHAIN_FAMILY_BY_NAME,
  SUB_CMD_EDIT_IDENTIFIER,
} from "@internal/app-binder/model/contactsConstants";
import { type ContactsErrorCodes } from "@internal/app-binder/model/contactsErrors";
import {
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvUInt8,
  STRUCT_TYPE_EDIT_IDENTIFIER,
  STRUCT_VERSION_VALUE,
} from "@internal/app-binder/services/contactsTlvSerializer";
import { sendFramedContactsPayload } from "@internal/app-binder/services/sendFramedContactsPayload";

export type EditIdentifierProof = {
  readonly hmacRest: Uint8Array;
};

export type SendEditExternalAddressIdentifierTaskArgs = {
  readonly contactName: string;
  readonly scope: string;
  readonly previousIdentifier: Uint8Array;
  readonly newIdentifier: Uint8Array;
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  readonly groupHandle: Uint8Array;
  readonly hmacProof: Uint8Array;
  readonly hmacRest: Uint8Array;
  readonly logger?: LoggerPublisherService;
};

export class SendEditExternalAddressIdentifierTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendEditExternalAddressIdentifierTaskArgs,
  ) {}

  async run(): Promise<CommandResult<EditIdentifierProof, ContactsErrorCodes>> {
    const payload = this.buildPayload(this.args);

    const result = (await sendFramedContactsPayload(this.api, {
      payload,
      p1: SUB_CMD_EDIT_IDENTIFIER,
      makeCommand: (chunk, p2) =>
        new EditExternalAddressIdentifierCommand({ data: chunk, p2 }),
      logger: this.args.logger,
      commandTag: "SendEditExternalAddressIdentifierTask",
    })) as CommandResult<
      { readonly hmacRest?: Uint8Array },
      ContactsErrorCodes
    >;

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    const { hmacRest } = result.data;
    if (!hmacRest) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "EditIdentifier final-chunk response did not carry hmac_rest",
        ),
      });
    }
    return DmkResultFactory({ data: { hmacRest } });
  }

  private buildPayload(
    args: SendEditExternalAddressIdentifierTaskArgs,
  ): Uint8Array {
    const family =
      BLOCKCHAIN_FAMILY_BY_NAME[args.blockchainFamily.toLowerCase()];
    if (family === undefined) {
      throw new Error(
        `Unsupported blockchain family: ${args.blockchainFamily}`,
      );
    }

    const builder = new ByteArrayBuilder();
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_TYPE,
      STRUCT_TYPE_EDIT_IDENTIFIER,
    );
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_VERSION,
      STRUCT_VERSION_VALUE,
    );
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.contactName);
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.SCOPE, args.scope);
    encodeTlvBuffer(
      builder,
      CONTACTS_TLV_TAG.ACCOUNT_IDENTIFIER,
      args.newIdentifier,
    );
    encodeTlvBuffer(
      builder,
      CONTACTS_TLV_TAG.PREVIOUS_IDENTIFIER,
      args.previousIdentifier,
    );
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.GROUP_HANDLE, args.groupHandle);
    if (args.chainId !== undefined) {
      encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    }
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.HMAC_PROOF, args.hmacProof);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.HMAC_REST, args.hmacRest);
    encodeTlvUInt8(builder, CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY, family);

    return builder.build();
  }
}
