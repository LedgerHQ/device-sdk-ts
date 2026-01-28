/**
 * Module identifiers for devtools handshake.
 * Used by both client modules and dashboard UI to track which modules are connected.
 */
export const DEVTOOLS_MODULES = {
  LOGGER: "logger",
  DMK_INSPECTOR: "dmk-inspector",
} as const;

export type DevToolsModule =
  (typeof DEVTOOLS_MODULES)[keyof typeof DEVTOOLS_MODULES];

/**
 * Message type for module connection handshake.
 */
export const MODULE_CONNECTED_MESSAGE_TYPE = "moduleConnected";
