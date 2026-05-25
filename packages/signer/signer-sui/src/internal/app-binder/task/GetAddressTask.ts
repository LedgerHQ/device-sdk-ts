import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type SuiAddress } from "@api/model/SuiAddress";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";
import { BlockProtocolTask } from "@internal/app-binder/task/BlockProtocolTask";
import { encodeSuiDerivationPath } from "@internal/app-binder/task/SuiDerivationPathUtils";

export type GetAddressTaskArgs = {
  derivationPath: string;
  checkOnDevice: boolean;
};

/**
 * Retrieves a Sui address (public key + address) from the Ledger device.
 * Uses INS 0x02 (GET_PUBKEY) or INS 0x01 (VERIFY_ADDRESS) depending on checkOnDevice.
 *
 * Response format: [pubkey_len (1)] [pubkey (32)] [address_len (1)] [address (32)]
 */
export class GetAddressTask {
  constructor(
    private api: InternalApi,
    private args: GetAddressTaskArgs,
  ) {}

  async run(): Promise<CommandResult<SuiAddress, SuiAppErrorCodes>> {
    const pathBytes = encodeSuiDerivationPath(this.args.derivationPath);
    const ins = this.args.checkOnDevice ? 0x01 : 0x02;

    const result = await new BlockProtocolTask(this.api, {
      cla: 0x00,
      ins,
      p1: 0x00,
      p2: 0x00,
      params: [pathBytes],
    }).run();

    if ("error" in result) {
      return result;
    }

    return parseAddressResponse(result.data);
  }
}

function parseAddressResponse(
  data: Uint8Array,
): CommandResult<SuiAddress, SuiAppErrorCodes> {
  if (data.length < 1) {
    return CommandResultFactory({
      error: new InvalidStatusWordError("Empty address response"),
    });
  }

  const keySize = data[0]!;
  if (data.length < 1 + keySize) {
    return CommandResultFactory({
      error: new InvalidStatusWordError("Response too short for public key"),
    });
  }

  const publicKey = data.slice(1, 1 + keySize);

  let address = new Uint8Array(0);
  const addressOffset = 1 + keySize;
  if (data.length > addressOffset + 1) {
    const addressSize = data[addressOffset]!;
    address = data.slice(addressOffset + 1, addressOffset + 1 + addressSize);
  }

  return CommandResultFactory({
    data: { publicKey, address },
  });
}
