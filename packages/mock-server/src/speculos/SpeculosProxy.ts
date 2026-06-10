import { type Device } from "@ledgerhq/device-mockserver-client";

import { matchApdu } from "../apdu/matcher";
import { UNKNOWN_APDU_RESPONSE } from "../defaults";
import { logger } from "../logger";
import { type SessionRecord, type SessionStore } from "../store/SessionStore";
import {
  buildRunId,
  CLOSE_APP_PREFIX,
  mapCoinApp,
  mapDeviceModel,
  parseOpenApp,
  SW_OK,
  SW_PROXY_ERROR,
  SW_UNKNOWN_APP,
} from "./openApp";
import { type SpeculinhoClient } from "./SpeculinhoClient";

export interface ResolveApduParams {
  readonly store: SessionStore;
  readonly record: SessionRecord;
  readonly device: Device;
  readonly apduHex: string;
  /** Configured Speculinho client, or `undefined` when proxying is disabled. */
  readonly client: SpeculinhoClient | undefined;
}

/**
 * Resolve the response for an incoming APDU, applying the following precedence:
 *
 * 1. If the device is already proxying to a Speculos instance, forward the APDU
 *    there (Close App releases the instance and reverts to mock mode).
 * 2. Otherwise serve the first matching mock.
 * 3. Otherwise, if the APDU is an Open App command and a Speculinho client is
 *    configured, start a Speculos instance for the requested app and switch the
 *    device into proxy mode.
 * 4. Otherwise fall back to {@link UNKNOWN_APDU_RESPONSE}.
 */
export async function resolveApdu(params: ResolveApduParams): Promise<string> {
  const { store, record, device, client } = params;
  const apdu = params.apduHex.toLowerCase();

  // 1. Active Speculos proxy: everything flows to the emulator.
  const proxy = store.getProxy(record, device.id);
  if (proxy && client) {
    if (apdu.startsWith(CLOSE_APP_PREFIX)) {
      store.deleteProxy(record, device.id);
      void client.release(proxy.runId);
      logger.info(`Speculos proxy released for ${device.id} (close app)`);
      return SW_OK;
    }
    try {
      const response = await client.forwardApdu(proxy.speculosUrl, apdu);
      logger.info(
        `APDU [${device.id}] ${apdu} -> ${response} (speculos ${proxy.runId})`,
      );
      return response;
    } catch (error) {
      logger.error(
        `Speculos proxy forward failed for ${device.id}: ${String(error)}`,
      );
      return SW_PROXY_ERROR;
    }
  }

  // 2. Mock match (existing behavior; an explicit mock always wins).
  const mock = matchApdu(apdu, store.listMocks(record));
  if (mock) {
    const response = store.consumeResponse(record, mock);
    logger.info(`APDU [${device.id}] ${apdu} -> ${response}`);
    return response;
  }

  // 3. Unmatched Open App: spin up a real Speculos instance.
  const appName = parseOpenApp(apdu);
  if (appName !== null && client) {
    return openAppViaSpeculos(params, appName);
  }

  // 4. Fallback.
  logger.warn(
    `APDU [${device.id}] ${apdu} -> ${UNKNOWN_APDU_RESPONSE} (no matching mock)`,
  );
  return UNKNOWN_APDU_RESPONSE;
}

async function openAppViaSpeculos(
  params: ResolveApduParams,
  appName: string,
): Promise<string> {
  const { store, record, device, client } = params;

  const app = device.apps?.find(
    (entry) => entry.name.toLowerCase() === appName.toLowerCase(),
  );
  if (!app) {
    logger.warn(
      `Open app "${appName}" rejected: not installed on ${device.id}`,
    );
    return SW_UNKNOWN_APP;
  }

  const model = mapDeviceModel(device.device_type);
  if (!model || !device.firmware_version) {
    logger.error(
      `Cannot start Speculos for ${device.id}: unsupported model ` +
        `"${device.device_type}" or missing firmware_version`,
    );
    return SW_PROXY_ERROR;
  }

  const coinApp = mapCoinApp(appName);
  const runId = buildRunId(coinApp, model);
  try {
    await client!.acquire(
      {
        coin_app: coinApp,
        coin_app_version: app.version,
        device: model,
        device_os_version: device.firmware_version,
      },
      runId,
    );
    const speculosUrl = await client!.waitUntilReady(runId);
    store.setProxy(record, device.id, { runId, speculosUrl, appName });
    logger.info(
      `Speculos ready for ${device.id}: app=${appName} coin=${coinApp} ` +
        `run=${runId} url=${speculosUrl}`,
    );
    return SW_OK;
  } catch (error) {
    logger.error(
      `Speculos acquire failed for ${device.id} (app=${appName}): ${String(error)}`,
    );
    void client!.release(runId);
    return SW_PROXY_ERROR;
  }
}
