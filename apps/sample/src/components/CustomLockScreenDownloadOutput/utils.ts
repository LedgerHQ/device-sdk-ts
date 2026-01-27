import { type DownloadCustomLockScreenDAOutput } from "@ledgerhq/dmk-ledger-wallet";

/**
 * Check if the device action output contains image data that can be displayed.
 */
export function hasImageData(
  output: DownloadCustomLockScreenDAOutput,
): output is { imageData: Uint8Array; imageHash: string } {
  return "imageData" in output && output.imageData instanceof Uint8Array;
}

/**
 * Check if the output indicates the image was already backed up.
 */
export function isAlreadyBackedUp(
  output: DownloadCustomLockScreenDAOutput,
): output is { alreadyBackedUp: true } {
  return "alreadyBackedUp" in output && output.alreadyBackedUp === true;
}
