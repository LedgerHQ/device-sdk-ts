// Builds the TLV payload for op 1 (Register Identity / Register External
// Address) and dispatches it via the chunked-framing scheme shared with the
// other address-book ops (2-byte BE total length + ≤255B chunks). The device
// returns the 129-byte register response on the final chunk.
//
// Reference: ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md
//   §5.1 register identity — tag order STRUCT_TYPE, STRUCT_VERSION,
//   CONTACT_NAME, SCOPE, ACCOUNT_IDENTIFIER, DERIVATION_PATH, CHAIN_ID,
//   BLOCKCHAIN_FAMILY, then optional GROUP_HANDLE + HMAC_PROOF on extension.
import {
  BLOCKCHAIN_FAMILY_ETH,
  ByteArrayBuilder,
  type CommandResult,
  CONTACTS_TLV_TAG,
  type ContactsErrorCodes,
  DmkResultFactory,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvHex,
  encodeTlvUInt8,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
  packDerivationPath,
  sendFramedContactsPayload,
  STRUCT_TYPE_REGISTER_IDENTITY,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  type RegisterExternalAddressArgs,
  type RegisterExternalAddressResult,
} from "@api/model/RegisterExternalAddressArgs";
import { RegisterIdentityCommand } from "@internal/app-binder/command/RegisterIdentityCommand";

const SUB_CMD_REGISTER_IDENTITY = 0x01;

type SendRegisterIdentityTaskArgs = RegisterExternalAddressArgs & {
  readonly logger: LoggerPublisherService;
};

export class SendRegisterIdentityTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendRegisterIdentityTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<
    CommandResult<RegisterExternalAddressResult, ContactsErrorCodes>
  > {
    const payload = this.buildPayload(this.args);

    this._logger.info("[run] payload built", {
      tag: "SendRegisterIdentityTask",
      data: {
        name: this.args.name,
        scope: this.args.scope,
        chainId: this.args.chainId,
        addressHex: this.args.addressHex,
        derivationPath: this.args.derivationPath,
        isExtension: this.args.extension !== undefined,
        extensionGroupHandle: this.args.extension?.groupHandleHex,
        payloadLen: payload.length,
      },
    });

    const result = (await sendFramedContactsPayload(this.api, {
      payload,
      p1: SUB_CMD_REGISTER_IDENTITY,
      makeCommand: (chunk, p2) =>
        new RegisterIdentityCommand({ data: chunk, p2 }),
      logger: this._logger,
      commandTag: "SendRegisterIdentityTask",
    })) as CommandResult<
      {
        readonly groupHandleHex?: string;
        readonly hmacNameHex?: string;
        readonly hmacRestHex?: string;
      },
      ContactsErrorCodes
    >;

    if (!isSuccessCommandResult(result)) {
      return result;
    }
    const { groupHandleHex, hmacNameHex, hmacRestHex } = result.data;
    if (!groupHandleHex || !hmacNameHex || !hmacRestHex) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "RegisterIdentity final-chunk response was incomplete",
        ),
      });
    }
    return DmkResultFactory({
      data: { groupHandleHex, hmacNameHex, hmacRestHex },
    });
  }

  private buildPayload(args: RegisterExternalAddressArgs): Uint8Array {
    const segments = DerivationPathUtils.splitPath(args.derivationPath);
    const pathBytes = packDerivationPath(segments);

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
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.name);
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.SCOPE, args.scope);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.ACCOUNT_IDENTIFIER, args.addressHex);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY,
      BLOCKCHAIN_FAMILY_ETH,
    );

    if (args.extension) {
      encodeTlvHex(
        builder,
        CONTACTS_TLV_TAG.GROUP_HANDLE,
        args.extension.groupHandleHex,
      );
      encodeTlvHex(
        builder,
        CONTACTS_TLV_TAG.HMAC_PROOF,
        args.extension.hmacProofHex,
      );
    }

    return builder.build();
  }
}
