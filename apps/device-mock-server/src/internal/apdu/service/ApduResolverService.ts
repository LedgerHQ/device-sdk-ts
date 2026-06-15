import { type Device } from "@ledgerhq/device-mockserver-client";
import { inject, injectable, optional } from "inversify";

import { matchApdu } from "@internal/apdu/service/matcher";
import { UNKNOWN_APDU_RESPONSE } from "@internal/defaults";
import { derivedTypes } from "@internal/derived/di/derivedTypes";
import { type DerivedOsCommandsService } from "@internal/derived/service/DerivedOsCommandsService";
import {
  GET_APP_AND_VERSION_PREFIX,
  GET_OS_VERSION_PREFIX,
} from "@internal/derived/service/osCommands";
import { logger } from "@internal/logger/logger";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { type SessionRecord } from "@internal/session/model/SessionModels";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";
import { type CloseAppUseCase } from "@internal/speculos/use-case/CloseAppUseCase";
import { type ForwardApduUseCase } from "@internal/speculos/use-case/ForwardApduUseCase";
import { type OpenAppViaSpeculosUseCase } from "@internal/speculos/use-case/OpenAppViaSpeculosUseCase";
import {
  CLOSE_APP_PREFIX,
  parseOpenApp,
  SW_OK,
  SW_PROXY_ERROR,
  SW_UNKNOWN_APP,
} from "@internal/speculos/util/openApp";

/**
 * Resolves the response for an incoming APDU, applying the precedence:
 * 1. explicit per-device mock (wins even while a Speculos proxy is active, so a
 *    mock can override an app response — e.g. force GetAppAndVersion to 5515),
 * 2. active Speculos proxy -> forward (Close App releases and reverts to mock),
 * 3. derived handshake (GetOsVersion / GetAppAndVersion),
 * 4. unmatched Open App -> provision a Speculos instance,
 * 5. {@link UNKNOWN_APDU_RESPONSE}.
 */
@injectable()
export class ApduResolverService {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @inject(derivedTypes.Service)
    private readonly derived: DerivedOsCommandsService,
    @optional()
    @inject(speculosTypes.OpenAppUseCase)
    private readonly openApp?: OpenAppViaSpeculosUseCase,
    @optional()
    @inject(speculosTypes.ForwardApduUseCase)
    private readonly forwardApdu?: ForwardApduUseCase,
    @optional()
    @inject(speculosTypes.CloseAppUseCase)
    private readonly closeApp?: CloseAppUseCase,
  ) {}

  async resolve(
    record: SessionRecord,
    device: Device,
    apduHex: string,
  ): Promise<string> {
    const apdu = apduHex.toLowerCase();

    // 1. Explicit per-device mock always wins — even while a Speculos proxy is
    //    active — so a mock can override an individual app response (e.g. force
    //    GetAppAndVersion to 5515 to simulate a locked device mid-session).
    const mocks = this.repository.listMocks(record, device.id).orDefault([]);
    const mock = matchApdu(apdu, mocks);
    if (mock) {
      const response = this.repository.consumeResponse(record, device.id, mock);
      logger.info(`APDU [${device.id}] ${apdu} -> ${response}`);
      return response;
    }

    // 2. Active Speculos proxy: unmatched APDUs flow to the emulator; Close App
    //    releases it and reverts the device to mock mode.
    const proxy = this.repository.findProxy(record, device.id).extract();
    if (proxy && this.forwardApdu && this.closeApp) {
      if (apdu.startsWith(CLOSE_APP_PREFIX)) {
        void this.closeApp.execute(record, device.id, proxy).run();
        logger.info(`Speculos proxy released for ${device.id} (close app)`);
        return SW_OK;
      }
      const result = await this.forwardApdu.execute(proxy, apdu).run();
      return result.caseOf({
        Left: (error) => {
          logger.error(
            `Speculos proxy forward failed for ${device.id}: ${error.message}`,
          );
          return SW_PROXY_ERROR;
        },
        Right: (response) => {
          logger.info(
            `APDU [${device.id}] ${apdu} -> ${response} (speculos ${proxy.runId})`,
          );
          return response;
        },
      });
    }

    // 3. Derived handshake responses synthesized from the device metadata.
    if (apdu.startsWith(GET_OS_VERSION_PREFIX)) {
      const response = this.derived.getOsVersion(device);
      if (response) {
        logger.info(`APDU [${device.id}] ${apdu} -> ${response} (derived)`);
        return response;
      }
    }
    if (apdu.startsWith(GET_APP_AND_VERSION_PREFIX)) {
      const response = this.derived.getAppAndVersion(device);
      logger.info(`APDU [${device.id}] ${apdu} -> ${response} (derived)`);
      return response;
    }

    // 4. Unmatched Open App: spin up a real Speculos instance.
    const appName = parseOpenApp(apdu);
    if (appName !== null && this.openApp) {
      const result = await this.openApp.execute(record, device, appName).run();
      return result.caseOf({
        Left: (error) => {
          if (error._tag === "AppNotInstalled") {
            logger.warn(
              `Open app "${appName}" rejected: not installed on ${device.id}`,
            );
            return SW_UNKNOWN_APP;
          }
          logger.error(
            `Speculos acquire failed for ${device.id} (app=${appName}): ${JSON.stringify(error)}`,
          );
          return SW_PROXY_ERROR;
        },
        Right: (session) => {
          logger.info(
            `Speculos ready for ${device.id}: app=${appName} run=${session.runId} url=${session.speculosUrl}`,
          );
          return SW_OK;
        },
      });
    }

    // 5. Fallback.
    logger.warn(
      `APDU [${device.id}] ${apdu} -> ${UNKNOWN_APDU_RESPONSE} (no matching mock)`,
    );
    return UNKNOWN_APDU_RESPONSE;
  }
}
