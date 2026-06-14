// Builds the TLV payload for op 3 (Edit Identifier / Edit external
// address) and dispatches it via the chunked-framing scheme shared
// with op 2 + the Provide ops.
//
// Reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:242-294
//   prepare_edit_identifier → tag order is STRUCT_TYPE, STRUCT_VERSION,
//   CONTACT_NAME, SCOPE, ACCOUNT_IDENTIFIER (new), PREVIOUS_IDENTIFIER (old),
//   GROUP_HANDLE, DERIVATION_PATH, CHAIN_ID, HMAC_PROOF (hmac_name),
//   HMAC_REST, BLOCKCHAIN_FAMILY=ETH.
import {
  BLOCKCHAIN_FAMILY_ETH,
  ByteArrayBuilder,
  type CommandResult,
  CommandResultFactory,
  CONTACTS_TLV_TAG,
  type ContactsErrorCodes,
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
  STRUCT_TYPE_EDIT_IDENTIFIER,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  type EditExternalAddressArgs,
  type EditExternalAddressResult,
} from "@api/model/EditExternalAddressArgs";
import { EditIdentifierCommand } from "@internal/app-binder/command/EditIdentifierCommand";

const SUB_CMD_EDIT_IDENTIFIER = 0x03;

type SendEditIdentifierTaskArgs = EditExternalAddressArgs & {
  readonly logger: LoggerPublisherService;
};

export class SendEditIdentifierTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendEditIdentifierTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<
    CommandResult<EditExternalAddressResult, ContactsErrorCodes>
  > {
    this._logger.debug("[run] Starting SendEditIdentifierTask", {
      data: {
        contactName: this.args.contactName,
        scope: this.args.scope,
        chainId: this.args.chainId,
      },
    });

    const payload = this.buildPayload(this.args);

    const result = (await sendFramedContactsPayload(this.api, {
      payload,
      p1: SUB_CMD_EDIT_IDENTIFIER,
      makeCommand: (chunk, p2) =>
        new EditIdentifierCommand({ data: chunk, p2 }),
    })) as CommandResult<{ readonly hmacRestHex?: string }, ContactsErrorCodes>;

    if (!isSuccessCommandResult(result)) {
      return result;
    }
    if (!result.data.hmacRestHex) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "EditIdentifier final-chunk response did not carry hmac_rest",
        ),
      });
    }
    return CommandResultFactory({
      data: { hmacRestHex: result.data.hmacRestHex },
    });
  }

  private buildPayload(args: SendEditIdentifierTaskArgs): Uint8Array {
    const segments = DerivationPathUtils.splitPath(args.derivationPath);
    const pathBytes = packDerivationPath(segments);

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
    encodeTlvHex(
      builder,
      CONTACTS_TLV_TAG.ACCOUNT_IDENTIFIER,
      args.newAddressHex,
    );
    encodeTlvHex(
      builder,
      CONTACTS_TLV_TAG.PREVIOUS_IDENTIFIER,
      args.oldAddressHex,
    );
    encodeTlvHex(builder, CONTACTS_TLV_TAG.GROUP_HANDLE, args.groupHandleHex);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.HMAC_PROOF, args.hmacProofHex);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.HMAC_REST, args.hmacRestHex);
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY,
      BLOCKCHAIN_FAMILY_ETH,
    );

    return builder.build();
  }
}
