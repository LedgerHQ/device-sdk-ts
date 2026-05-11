// Builds the TLV payload for op 1 (Register Identity / Register External
// Address) and dispatches it via RegisterIdentityCommand. Single APDU,
// no chunking — payload is ≤ 179 bytes in worst case (extension), well
// under the 255-byte APDU data limit.
//
// Reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:187-223
//   prepare_register_identity → tag order is STRUCT_TYPE, STRUCT_VERSION,
//   CONTACT_NAME, SCOPE, ACCOUNT_IDENTIFIER, DERIVATION_PATH, CHAIN_ID,
//   BLOCKCHAIN_FAMILY, then optional GROUP_HANDLE + HMAC_PROOF on extension.
import {
  ByteArrayBuilder,
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type RegisterExternalAddressArgs } from "@api/model/RegisterExternalAddressArgs";
import {
  RegisterIdentityCommand,
  type RegisterIdentityCommandResponse,
} from "@internal/app-binder/command/RegisterIdentityCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import {
  BLOCKCHAIN_FAMILY_ETH,
  CONTACTS_TLV_TAG,
  encodeTlvAscii,
  encodeTlvBuffer,
  encodeTlvChainId,
  encodeTlvHex,
  encodeTlvUInt8,
  packDerivationPath,
  STRUCT_TYPE_REGISTER_IDENTITY,
  STRUCT_VERSION_VALUE,
} from "@ledgerhq/device-management-kit";

const APDU_DATA_MAX_BYTES = 255;

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
    CommandResult<RegisterIdentityCommandResponse, EthErrorCodes>
  > {
    this._logger.debug("[run] Starting SendRegisterIdentityTask", {
      data: {
        name: this.args.name,
        chainId: this.args.chainId,
        isExtension: this.args.extension !== undefined,
      },
    });

    const payload = this.buildPayload(this.args);

    if (payload.length > APDU_DATA_MAX_BYTES) {
      this._logger.error("[run] Payload exceeds APDU data limit", {
        data: { length: payload.length, max: APDU_DATA_MAX_BYTES },
      });
      return DmkResultFactory({
        error: new InvalidStatusWordError(
          `Register identity payload is ${payload.length} bytes (max ${APDU_DATA_MAX_BYTES}).`,
        ),
      });
    }

    return this.api.sendCommand(new RegisterIdentityCommand({ data: payload }));
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
