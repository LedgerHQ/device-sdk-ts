// Builds the TLV payload for the M7 runtime op "Provide Ledger Account
// Contact" (P1=0x21) and dispatches it via the chunked-framing scheme
// shared with op 2/3 and the sibling Provide-Contact op.
//
// Reference:
// ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md
//   prepare_provide_ledger_account_contact → tag order is STRUCT_TYPE,
//   STRUCT_VERSION, CONTACT_NAME, DERIVATION_PATH, CHAIN_ID,
//   BLOCKCHAIN_FAMILY, HMAC_PROOF (the 32-byte proof returned by op 5).
//
// Device derives the address from the BIP32 path internally and replies
// SW=0x9000 with empty data on success. Same op is used for both
// From-side and To-side decoration when the counterparty is a Ledger
// account (the form picks From vs To by varying the args, not the op).
import {
  BLOCKCHAIN_FAMILY_ETH,
  ByteArrayBuilder,
  type CommandResult,
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvHex,
  encodeTlvUInt8,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
  packDerivationPath,
  sendFramedContactsPayload,
  STRUCT_TYPE_PROVIDE_LEDGER_ACCOUNT_CONTACT,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  type ProvideLedgerAccountArgs,
  type ProvideLedgerAccountResult,
} from "@api/model/ProvideLedgerAccountArgs";
import { ProvideLedgerAccountCommand } from "@internal/app-binder/command/ProvideLedgerAccountCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

const SUB_CMD_PROVIDE_LEDGER_ACCOUNT_CONTACT = 0x21;

type SendProvideLedgerAccountTaskArgs = ProvideLedgerAccountArgs & {
  readonly logger: LoggerPublisherService;
};

export class SendProvideLedgerAccountTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendProvideLedgerAccountTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<
    CommandResult<ProvideLedgerAccountResult, EthErrorCodes>
  > {
    const payload = this.buildPayload(this.args);

    this._logger.info("[run] payload built", {
      tag: "SendProvideLedgerAccountTask",
      data: {
        accountName: this.args.accountName,
        chainId: this.args.chainId,
        derivationPath: this.args.derivationPath,
        hmacProofLen: this.args.hmacProofHex.length / 2,
        payloadLen: payload.length,
      },
    });

    const result = (await sendFramedContactsPayload(this.api, {
      payload,
      p1: SUB_CMD_PROVIDE_LEDGER_ACCOUNT_CONTACT,
      makeCommand: (chunk, p2) =>
        new ProvideLedgerAccountCommand({ data: chunk, p2 }),
      logger: this._logger,
      commandTag: "provideLedgerAccount",
    })) as CommandResult<ProvideLedgerAccountResult, EthErrorCodes>;

    if (!isSuccessCommandResult(result)) {
      return result;
    }
    return result;
  }

  private buildPayload(args: SendProvideLedgerAccountTaskArgs): Uint8Array {
    const segments = DerivationPathUtils.splitPath(args.derivationPath);
    const pathBytes = packDerivationPath(segments);

    const builder = new ByteArrayBuilder();
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_TYPE,
      STRUCT_TYPE_PROVIDE_LEDGER_ACCOUNT_CONTACT,
    );
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_VERSION,
      STRUCT_VERSION_VALUE,
    );
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.accountName);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY,
      BLOCKCHAIN_FAMILY_ETH,
    );
    encodeTlvHex(builder, CONTACTS_TLV_TAG.HMAC_PROOF, args.hmacProofHex);

    return builder.build();
  }
}
