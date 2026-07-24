// Renaming a Ledger account (P1=0x12) via the chunked-framing scheme: the
// device verifies the seed-bound HMAC proof, shows the rename review, and
// returns a freshly rotated proof on the final chunk. Unlike
// RegisterLedgerAccount there is no follow-up GetAddress — the address is
// unchanged by a rename. Wrapped by CallTaskInAppDeviceAction in EthAppBinder
// to match every other action in the package.
//
// Reference: ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md
//   §5.6 edit ledger account — tags STRUCT_TYPE, STRUCT_VERSION,
//   PREVIOUS_CONTACT_NAME, CONTACT_NAME, HMAC_PROOF, DERIVATION_PATH, CHAIN_ID,
//   BLOCKCHAIN_FAMILY.
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
  STRUCT_TYPE_EDIT_LEDGER_ACCOUNT,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  type EditLedgerAccountArgs,
  type EditLedgerAccountResult,
} from "@api/model/EditLedgerAccountArgs";
import { EditLedgerAccountCommand } from "@internal/app-binder/command/EditLedgerAccountCommand";

const SUB_CMD_EDIT_LEDGER_ACCOUNT = 0x12;

type SendEditLedgerAccountTaskArgs = EditLedgerAccountArgs & {
  readonly logger: LoggerPublisherService;
};

export class SendEditLedgerAccountTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly _api: InternalApi,
    private readonly _args: SendEditLedgerAccountTaskArgs,
  ) {
    this._logger = _args.logger;
  }

  async run(): Promise<
    CommandResult<EditLedgerAccountResult, ContactsErrorCodes>
  > {
    this._logger.info("[run] starting EditLedgerAccount", {
      tag: "SendEditLedgerAccountTask",
      data: {
        oldName: this._args.oldName,
        name: this._args.name,
        chainId: this._args.chainId,
        derivationPath: this._args.derivationPath,
      },
    });

    const payload = this.buildPayload(this._args);
    const result = (await sendFramedContactsPayload(this._api, {
      payload,
      p1: SUB_CMD_EDIT_LEDGER_ACCOUNT,
      makeCommand: (chunk, p2) =>
        new EditLedgerAccountCommand({ data: chunk, p2 }),
      logger: this._logger,
      commandTag: "SendEditLedgerAccountTask",
    })) as CommandResult<
      { readonly hmacProofHex?: string },
      ContactsErrorCodes
    >;

    if (!isSuccessCommandResult(result)) {
      return result;
    }
    if (!result.data.hmacProofHex) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "EditLedgerAccount final-chunk response did not carry hmac_proof",
        ),
      });
    }
    return DmkResultFactory({
      data: { hmacProofHex: result.data.hmacProofHex },
    });
  }

  private buildPayload(args: EditLedgerAccountArgs): Uint8Array {
    const segments = DerivationPathUtils.splitPath(args.derivationPath);
    const pathBytes = packDerivationPath(segments);

    const builder = new ByteArrayBuilder();
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_TYPE,
      STRUCT_TYPE_EDIT_LEDGER_ACCOUNT,
    );
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_VERSION,
      STRUCT_VERSION_VALUE,
    );
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.name);
    encodeTlvAscii(
      builder,
      CONTACTS_TLV_TAG.PREVIOUS_CONTACT_NAME,
      args.oldName,
    );
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.HMAC_PROOF, args.hmacProofHex);
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY,
      BLOCKCHAIN_FAMILY_ETH,
    );

    return builder.build();
  }
}
