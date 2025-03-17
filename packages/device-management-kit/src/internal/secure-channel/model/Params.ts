/**
 * Base parameters for various operations.
 *
 * @property targetId - The target identifier.
 * @property perso - The personalization string.
 */
type BaseParams = {
  targetId: string;
  perso: string;
};

/**
 * Parameters specific to MCU updates.
 *
 * @property version - The version of the MCU.
 */
type McuSubParams = { version: string };

/**
 * Parameters specific to firmware updates, applicable to both Final Firmware and OSU Firmware.
 *
 * @property firmware - The firmware identifier.
 * @property firmwareKey - The key associated with the firmware.
 */
type FirmwareSubParams = {
  firmware: string;
  firmwareKey: string;
};

/**
 * Parameters specific to app operations.
 *
 * @property hash - The hash of the app.
 */
type AppHash = {
  hash: string;
};

/**
 * Parameters for genuine check operations.
 */
export type GenuineCheckParams = BaseParams;

/**
 * Parameters for listing installed apps.
 */
export type ListInstalledAppsParams = BaseParams;

/**
 * Parameters for updating the MCU.
 *
 * @property targetId - The target identifier.
 * @property version - The version of the MCU.
 */
export type UpdateMcuParams = Omit<BaseParams, "perso"> & McuSubParams;

/**
 * Parameters for updating the firmware.
 *
 * @property targetId - The target identifier.
 * @property perso - The personalization string.
 * @property firmware - The firmware identifier.
 * @property firmwareKey - The key associated with the firmware.
 */
export type UpdateFirmwareParams = BaseParams & FirmwareSubParams;

/**
 * Parameters for installing apps.
 *
 * @property targetId - The target identifier.
 * @property perso - The personalization string.
 * @property firmware - The firmware identifier.
 * @property firmwareKey - The key associated with the firmware.
 * @property deleteKey - The key used to delete the app.
 * @property hash - The hash of the app.
 */
export type InstallAppsParams = BaseParams & FirmwareSubParams & AppHash;

/**
 * Parameters for uninstalling apps.
 *
 * @property targetId - The target identifier.
 * @property perso - The personalization string.
 * @property firmware - The firmware identifier.
 * @property firmwareKey - The key associated with the firmware.
 * @property deleteKey - The key used to delete the app.
 * @property hash - The hash of the app.
 */
export type UninstallAppsParams = BaseParams & FirmwareSubParams & AppHash;
