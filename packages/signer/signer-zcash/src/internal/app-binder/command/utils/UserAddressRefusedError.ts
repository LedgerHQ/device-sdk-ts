import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { type ZcashErrorCodes } from "./zcashApplicationErrors";

/**
 * The device refused an output that carried the receivers of the unified
 * address the user entered.
 *
 * Reported in place of the 6a80 the app answers on the last packet of that
 * output. The status word is shared with every other malformed-data refusal, and
 * on a shielded action the device validates the whole action at that packet, so
 * the receivers are the likeliest cause but not the only possible one.
 *
 * Raised by the kit itself, not a status word.
 */
export class UserAddressRefusedError extends DeviceExchangeError<ZcashErrorCodes> {
  /** Pool of the refused output. */
  readonly pool: "transparent" | "orchard" | "ironwood";
  /** Index of the refused output within its pool. */
  readonly index: number;

  constructor(pool: "transparent" | "orchard" | "ironwood", index: number) {
    super({
      tag: "UserAddressRefusedError",
      message: `The device refused the ${pool} output #${index}, which carried the receivers of the address the user entered. The receivers may be invalid for this output, or the output itself may be unacceptable to the device.`,
      errorCode: "user_address_refused",
    });
    this.pool = pool;
    this.index = index;
  }
}
