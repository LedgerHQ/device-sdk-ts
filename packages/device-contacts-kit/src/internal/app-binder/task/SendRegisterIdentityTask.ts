// Builds the TLV payload for op 1 (Register Identity / Register External
// Address) and dispatches it via the chunked-framing scheme shared with the
// other address-book ops (2-byte BE total length + <=255B chunks). The device
// returns the 129-byte register response on the final chunk.
//
// Reference: Address Book Final Specifications — Register Identity. Tag order:
//   STRUCT_TYPE, STRUCT_VERSION, CONTACT_NAME, SCOPE, ACCOUNT_IDENTIFIER,
//   CHAIN_ID (Ethereum only), BLOCKCHAIN_FAMILY, then optional GROUP_HANDLE +
//   HMAC_PROOF when extending an existing group.
//
// No DERIVATION_PATH. The tag's status changed three times in the BOLOS SDK,
// and the address-book TLV parser is compiled into the app (app_features/), so
// the SDK revision the app was *built* against decides — not the app version,
// which reads 1.23.0-dev either way:
//   - before 2026-08-07: tag 0x69 present and MANDATORY, omitting it -> 0x6a80
//   - 8e7e7a4f (2026-08-07): made optional, both forms accepted
//   - a0bb21f5 (2026-08-10): removed, sending it -> 0x6a80 (unknown tag)
// Omitting it is therefore correct for any app built from 2026-08-07 onward,
// and wrong for one built before. Both ends verified on hardware: a Flex
// running a pre-08-07 build of app-ethereum a79f9f8f rejects the payload
// without the tag in 9ms and no review screen; Speculos running a post-08-10
// build of the same commit rejects it *with* the tag, the same way.
// The OS derives the HMAC key from a fixed internal path.
import {
  ByteArrayBuilder,
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type ExistingContactGroup } from "@api/model/RegisterExternalAddress";
import { RegisterIdentityCommand } from "@internal/app-binder/command/RegisterIdentityCommand";
import {
  BLOCKCHAIN_FAMILY_BY_NAME,
  SUB_CMD_REGISTER_IDENTITY,
} from "@internal/app-binder/model/contactsConstants";
import { type ContactsErrorCodes } from "@internal/app-binder/model/contactsErrors";
import {
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvUInt8,
  STRUCT_TYPE_REGISTER_IDENTITY,
  STRUCT_VERSION_VALUE,
} from "@internal/app-binder/services/contactsTlvSerializer";
import { sendFramedContactsPayload } from "@internal/app-binder/services/sendFramedContactsPayload";

export type RegisterIdentityProofs = {
  readonly groupHandle: Uint8Array;
  readonly hmacProof: Uint8Array;
  readonly hmacRest: Uint8Array;
};

export type SendRegisterIdentityTaskArgs = {
  readonly contactName: string;
  readonly scope: string;
  readonly identifier: Uint8Array;
  readonly blockchainFamily: string;
  readonly chainId?: bigint;
  readonly existingContactGroup?: ExistingContactGroup;
  readonly logger?: LoggerPublisherService;
};

export class SendRegisterIdentityTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendRegisterIdentityTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<RegisterIdentityProofs, ContactsErrorCodes>
  > {
    const payload = this.buildPayload(this.args);

    const result = (await sendFramedContactsPayload(this.api, {
      payload,
      p1: SUB_CMD_REGISTER_IDENTITY,
      makeCommand: (chunk, p2) =>
        new RegisterIdentityCommand({ data: chunk, p2 }),
      logger: this.args.logger,
      commandTag: "SendRegisterIdentityTask",
    })) as CommandResult<
      {
        readonly groupHandle?: Uint8Array;
        readonly hmacProof?: Uint8Array;
        readonly hmacRest?: Uint8Array;
      },
      ContactsErrorCodes
    >;

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    const { groupHandle, hmacProof, hmacRest } = result.data;
    if (!groupHandle || !hmacProof || !hmacRest) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "RegisterIdentity final-chunk response was incomplete",
        ),
      });
    }
    return DmkResultFactory({ data: { groupHandle, hmacProof, hmacRest } });
  }

  private buildPayload(args: SendRegisterIdentityTaskArgs): Uint8Array {
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
      STRUCT_TYPE_REGISTER_IDENTITY,
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
      args.identifier,
    );
    if (args.chainId !== undefined) {
      encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    }
    encodeTlvUInt8(builder, CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY, family);

    if (args.existingContactGroup) {
      encodeTlvBuffer(
        builder,
        CONTACTS_TLV_TAG.GROUP_HANDLE,
        args.existingContactGroup.groupHandle,
      );
      encodeTlvBuffer(
        builder,
        CONTACTS_TLV_TAG.HMAC_PROOF,
        args.existingContactGroup.hmacProof,
      );
    }

    return builder.build();
  }
}
