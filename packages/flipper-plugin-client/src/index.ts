import { type DMKFlipperPlugin } from "@ledgerhq/device-management-kit";
import { flipperClient } from "js-flipper";
import { Subscription } from "rxjs";

import { FlipperSdkLogger } from "./FlipperSdkLogger";

flipperClient.start("ledger-device-sdk");

/**
 * Call this function and pass the returned object to the addFlipperPlugin
 * function of the builder of Ledger Device Management Kit builder.
 * @returns FlipperPluginSetupParams
 *
 * @example
 * ```ts
 * const sdk = new DeviceSdkBuilder()
 *  .setupFlipperPlugin(initialiseFlipperPlugin())
 *  .build();
 * ```
 */
export function initialiseFlipperPlugin(): DMKFlipperPlugin {
  const logger = new FlipperSdkLogger();
  let loggerSubscription: Subscription | null = null;

  flipperClient?.addPlugin({
    getId() {
      return "ledger-device-sdk";
    },
    onConnect(connection) {
      loggerSubscription?.unsubscribe(); // NOTE: this cleanup is necessary to avoid sending double events on reconnection (in cases onDisconnect has not been called)
      connection.send("init", { message: "Hello, Flipper!" });

      /** LOGS MODULE */
      loggerSubscription = logger.subscribeToLogs((log) => {
        connection.send("addLog", log);
      });
    },
    onDisconnect() {
      loggerSubscription?.unsubscribe();
    },
  });

  return {
    loggerSubscriberService: logger,
  };
}
