import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";

import { type Curve } from "@api/model/Curve";
import { DEFAULT_CURVE } from "@internal/app-binder/constants";
import { SignTransactionDeviceAction } from "@internal/app-binder/device-action/SignTransaction/SignTransactionDeviceAction";

/**
 * Build the device action that opens the XRP app, if needed, and runs
 * {@link SendSignTransactionTask} on it.
 *
 * **Serialized transaction (double source):**
 * - **Direct / binder path** (`executeDeviceAction`): pass `transaction` here;
 *   it becomes `deviceAction.input` and seeds the machine context.
 * - **Nested path** (`makeStateMachine` + invoke): omit `transaction` (defaults
 *   to an empty `Uint8Array`); supply the real bytes on the parent invoke
 *   `input`, which becomes `context.input.transaction` at runtime.
 *
 * Existing callers that pass `transaction` keep working unchanged. Signing
 * rejects if neither source provides a non-empty buffer.
 */
export const SignTransactionDeviceActionFactory = (args: {
  derivationPath: string;
  /**
   * Serialized XRP transaction. Optional for nested actors (override via invoke
   * `input`); defaults to an empty buffer so construction stays typed.
   */
  transaction?: Uint8Array;
  skipOpenApp: boolean;
  /** Curve to sign with. Defaults to `Curve.Secp256k1`. */
  curve?: Curve;
  loggerFactory: (tag: string) => LoggerPublisherService;
}): SignTransactionDeviceAction =>
  new SignTransactionDeviceAction({
    input: {
      derivationPath: args.derivationPath,
      transaction: args.transaction ?? new Uint8Array(),
      skipOpenApp: args.skipOpenApp,
      curve: args.curve ?? DEFAULT_CURVE,
      loggerFactory: args.loggerFactory,
    },
    logger: args.loggerFactory("SignTransactionDeviceAction"),
  });
