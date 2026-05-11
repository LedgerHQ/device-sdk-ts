// Builds the TLV payload for the M7 runtime op "Provide Contact" (P1=0x20)
// and dispatches it via the chunked-framing scheme shared with op 2/3 and
// the sibling Provide-Ledger-Account-Contact op.
//
// Reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:393-447
//   prepare_provide_contact → tag order is STRUCT_TYPE, STRUCT_VERSION,
//   CONTACT_NAME, SCOPE, ACCOUNT_IDENTIFIER, GROUP_HANDLE, DERIVATION_PATH,
//   CHAIN_ID, BLOCKCHAIN_FAMILY, HMAC_PROOF (= hmac_name), HMAC_REST.
//
// Device replies SW=0x9000 with empty data on success — no fields to extract.
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
  STRUCT_TYPE_PROVIDE_CONTACT,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  type ProvideContactArgs,
  type ProvideContactResult,
} from "@api/model/ProvideContactArgs";
import { ProvideContactCommand } from "@internal/app-binder/command/ProvideContactCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

const SUB_CMD_PROVIDE_CONTACT = 0x20;

type SendProvideContactTaskArgs = ProvideContactArgs & {
  readonly logger: LoggerPublisherService;
};

export class SendProvideContactTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendProvideContactTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<CommandResult<ProvideContactResult, EthErrorCodes>> {
    this._logger.debug("[run] Starting SendProvideContactTask", {
      data: {
        contactName: this.args.contactName,
        scope: this.args.scope,
        chainId: this.args.chainId,
      },
    });

    const payload = this.buildPayload(this.args);

    const result = (await sendFramedContactsPayload(this.api, {
      payload,
      p1: SUB_CMD_PROVIDE_CONTACT,
      makeCommand: (chunk, p2) =>
        new ProvideContactCommand({ data: chunk, p2 }),
    })) as CommandResult<ProvideContactResult, EthErrorCodes>;

    if (!isSuccessCommandResult(result)) {
      return result;
    }
    return result;
  }

  private buildPayload(args: SendProvideContactTaskArgs): Uint8Array {
    const segments = DerivationPathUtils.splitPath(args.derivationPath);
    const pathBytes = packDerivationPath(segments);

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
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.contactName);
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.SCOPE, args.scope);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.ACCOUNT_IDENTIFIER, args.addressHex);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.GROUP_HANDLE, args.groupHandleHex);
    encodeTlvBuffer(builder, CONTACTS_TLV_TAG.DERIVATION_PATH, pathBytes);
    encodeTlvChainId(builder, CONTACTS_TLV_TAG.CHAIN_ID, args.chainId);
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.BLOCKCHAIN_FAMILY,
      BLOCKCHAIN_FAMILY_ETH,
    );
    encodeTlvHex(builder, CONTACTS_TLV_TAG.HMAC_PROOF, args.hmacNameHex);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.HMAC_REST, args.hmacRestHex);

    return builder.build();
  }
}
