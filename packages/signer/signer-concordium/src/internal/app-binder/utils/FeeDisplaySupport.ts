import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import { isAtLeastVersion } from "@internal/app-binder/utils/FeeDisplay";

/**
 * Decide whether the open Concordium app accepts the P2=FEE_DISPLAY APDU
 * extension. Returns false on any error (wrong app, unknown INS on older
 * firmwares, malformed version string) so signing always falls back to the
 * legacy path with no fee screen rather than failing the whole transaction.
 *
 * When `displayFeeMicroCcd` is undefined the caller doesn't want fee display
 * regardless of firmware support, so we skip the probe entirely — this avoids
 * the extra round-trip for callers that don't care about fee display.
 */
export async function shouldUseFeeDisplay(
  api: InternalApi,
  displayFeeMicroCcd: bigint | undefined,
): Promise<boolean> {
  if (displayFeeMicroCcd === undefined) return false;

  try {
    const result = await api.sendCommand(new GetAppConfigCommand());
    if (!isSuccessCommandResult(result)) return false;
    return isAtLeastVersion(result.data.version);
  } catch {
    return false;
  }
}
