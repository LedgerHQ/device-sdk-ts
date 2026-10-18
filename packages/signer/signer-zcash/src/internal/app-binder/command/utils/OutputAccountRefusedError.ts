import { DeviceExchangeError } from "@ledgerhq/device-management-kit";

import { type ZcashErrorCodes } from "./zcashApplicationErrors";

/**
 * The device refused an Orchard or Ironwood action that carries an output
 * account declaration (status 6a80 on its metadata packet).
 *
 * The device validates the whole action at that packet, so the declaration is the
 * most likely cause (the output does not belong to the declared account) but not
 * the only one; the message does not claim certainty.
 */
export class OutputAccountRefusedError extends DeviceExchangeError<ZcashErrorCodes> {
  readonly pool: "orchard" | "ironwood";
  readonly actionIndex: number;
  readonly account: number;

  constructor(
    pool: "orchard" | "ironwood",
    actionIndex: number,
    account: number,
  ) {
    super({
      tag: "OutputAccountRefusedError",
      message: `The device refused ${pool} action ${actionIndex}, which declares output account ${account}. Most likely the output does not belong to that account of the same seed.`,
      errorCode: "output_account_refused",
    });
    this.pool = pool;
    this.actionIndex = actionIndex;
    this.account = account;
  }
}
