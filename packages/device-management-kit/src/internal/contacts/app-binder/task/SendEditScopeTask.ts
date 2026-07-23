// Builds the TLV payload for op 2 (Edit Scope / Edit external address
// label) and dispatches it via the chunked-framing scheme shared with
// op 3 + the Provide ops.
//
// Reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:337-391
//   prepare_edit_scope → tag order is STRUCT_TYPE, STRUCT_VERSION,
//   CONTACT_NAME, SCOPE (new), ACCOUNT_IDENTIFIER (address),
//   PREVIOUS_SCOPE (old), GROUP_HANDLE, DERIVATION_PATH, CHAIN_ID,
//   HMAC_PROOF (hmac_name), HMAC_REST, BLOCKCHAIN_FAMILY=ETH.
import { ByteArrayBuilder } from "@api/apdu/utils/ByteArrayBuilder";
import { InvalidStatusWordError } from "@api/command/Errors";
import { type CommandResult } from "@api/command/model/CommandResult";
import {
  type EditExternalAddressLabelArgs,
  type EditExternalAddressLabelResult,
} from "@api/contacts/model/EditExternalAddressLabelArgs";
import {
  BLOCKCHAIN_FAMILY_ETH,
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvHex,
  encodeTlvUInt8,
  packDerivationPath,
  STRUCT_TYPE_EDIT_SCOPE,
  STRUCT_VERSION_VALUE,
} from "@api/contacts/utils/contactsTlvSerializer";
import { sendFramedContactsPayload } from "@api/contacts/utils/sendFramedContactsPayload";
import { type InternalApi } from "@api/device-action/DeviceAction";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DmkResultFactory, isSuccessDmkResult } from "@api/model/DmkResult";
import { EditScopeCommand } from "@internal/contacts/app-binder/command/EditScopeCommand";

const SUB_CMD_EDIT_SCOPE = 0x04;

type SendEditScopeTaskArgs = EditExternalAddressLabelArgs & {
  readonly logger: LoggerPublisherService;
};

export class SendEditScopeTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private api: InternalApi,
    private args: SendEditScopeTaskArgs,
  ) {
    this._logger = args.logger;
  }

  async run(): Promise<CommandResult<EditExternalAddressLabelResult>> {
    const payload = this.buildPayload(this.args);

    this._logger.info("[run] payload built", {
      tag: "SendEditScopeTask",
      data: {
        contactName: this.args.contactName,
        oldLabel: this.args.oldLabel,
        newLabel: this.args.newLabel,
        addressHex: this.args.addressHex,
        chainId: this.args.chainId,
        derivationPath: this.args.derivationPath,
        groupHandleHex: this.args.groupHandleHex,
        hmacProofLen: this.args.hmacProofHex.length / 2,
        hmacRestLen: this.args.hmacRestHex.length / 2,
        payloadLen: payload.length,
      },
    });

    const result = await sendFramedContactsPayload(this.api, {
      payload,
      p1: SUB_CMD_EDIT_SCOPE,
      makeCommand: (chunk, p2) => new EditScopeCommand({ data: chunk, p2 }),
      logger: this._logger,
      commandTag: "editScope",
    });

    if (!isSuccessDmkResult(result)) {
      return result;
    }
    // The final chunk's response carries the rotated hmac_rest; if it's
    // missing, the device returned a malformed structure.
    if (!result.data.hmacRestHex) {
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          "EditScope final-chunk response did not carry hmac_rest",
        ),
      });
    }
    return DmkResultFactory({
      data: { hmacRestHex: result.data.hmacRestHex },
    });
  }

  private buildPayload(args: SendEditScopeTaskArgs): Uint8Array {
    const segments = splitPath(args.derivationPath);
    const pathBytes = packDerivationPath(segments);

    const builder = new ByteArrayBuilder();
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_TYPE,
      STRUCT_TYPE_EDIT_SCOPE,
    );
    encodeTlvUInt8(
      builder,
      CONTACTS_TLV_TAG.STRUCT_VERSION,
      STRUCT_VERSION_VALUE,
    );
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.CONTACT_NAME, args.contactName);
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.SCOPE, args.newLabel);
    encodeTlvHex(builder, CONTACTS_TLV_TAG.ACCOUNT_IDENTIFIER, args.addressHex);
    encodeTlvAscii(builder, CONTACTS_TLV_TAG.PREVIOUS_SCOPE, args.oldLabel);
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

// Inline twin of SendEditContactNameTask's splitPath. The third call
// site (M7 Provide ops) will trigger extraction.
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
