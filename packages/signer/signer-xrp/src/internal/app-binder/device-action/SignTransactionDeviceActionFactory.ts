import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { type Curve } from "@api/model/Curve";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction";
import { DEFAULT_CURVE } from "@internal/app-binder/constants";

/**
 * Build the device action that opens the XRP app, if needed, and runs
 * {@link SendSignTransactionTask} on it.
 *
 * `transaction` is part of the device-action input (not closed over a task), so
 * nested flows can pass bytes at invoke time after they are known.
 */
export const SignTransactionDeviceActionFactory = (args: {
  derivationPath: string;
  transaction: Uint8Array;
  skipOpenApp: boolean;
  /** Curve to sign with. Defaults to `Curve.Secp256k1`. */
  curve?: Curve;
  loggerFactory: (tag: string) => LoggerPublisherService;
}): SignTransactionDeviceAction =>
  new SignTransactionDeviceAction({
    input: {
      derivationPath: args.derivationPath,
      transaction: args.transaction,
      skipOpenApp: args.skipOpenApp,
      curve: args.curve ?? DEFAULT_CURVE,
      loggerFactory: args.loggerFactory,
    },
    logger: args.loggerFactory("SignTransactionDeviceAction"),
  });
