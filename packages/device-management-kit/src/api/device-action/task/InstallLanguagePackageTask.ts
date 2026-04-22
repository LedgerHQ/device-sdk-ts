import axios from "axios";
import { Observable } from "rxjs";

import { CommandUtils } from "@api/command/utils/CommandUtils";
import type { InternalApi } from "@api/device-action/DeviceAction";
import {
  OutOfMemoryDAError,
  RefusedByUserDAError,
  UnknownDAError,
} from "@api/device-action/os/Errors";
import type { InstallLanguagePackageDAError } from "@api/device-action/os/InstallLanguagePackage/types";
import { bufferToHexaString, hexaStringToBuffer } from "@api/utils/HexaString";

export type InstallLanguagePackageTaskArgs = {
  apduInstallUrl: string;
};

export type InstallLanguagePackageTaskError = Extract<
  InstallLanguagePackageDAError,
  RefusedByUserDAError | OutOfMemoryDAError | UnknownDAError
>;

export type InstallLanguagePackageEvent = {
  type: "progress";
  progress: number;
};

export class InstallLanguagePackageTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: InstallLanguagePackageTaskArgs,
  ) {}

  run(): Observable<InstallLanguagePackageEvent> {
    return new Observable((subscriber) => {
      const execute = async () => {
        let rawApdus: string;
        try {
          const response = await axios.get<string>(this.args.apduInstallUrl);
          rawApdus = response.data;
        } catch (error) {
          throw new UnknownDAError(
            `Failed to fetch APDUs: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        const apdus = rawApdus.split(/\r?\n/).filter(Boolean);
        if (typeof rawApdus !== "string" || apdus.length === 0) {
          throw new UnknownDAError(
            `Language pack install script contains no APDUs: ${this.args.apduInstallUrl}`,
          );
        }

        for (let i = 0; i < apdus.length; i++) {
          const apduHex = apdus[i]!;
          const apdu = hexaStringToBuffer(apduHex);
          if (apdu === null || apdu.length < 5) {
            throw new UnknownDAError(`Invalid APDU data: ${apduHex}`);
          }

          const response = await this.api.sendApdu(apdu);

          const error = response.caseOf({
            Left: (err) =>
              new UnknownDAError(`Device communication error: ${String(err)}`),
            Right: (apduResponse) => {
              if (CommandUtils.isRefusedByUser(apduResponse)) {
                return new RefusedByUserDAError(
                  "Language install refused on device.",
                );
              }
              if (CommandUtils.isOutOfMemory(apduResponse)) {
                return new OutOfMemoryDAError(
                  "Not enough space for language pack.",
                );
              }
              if (!CommandUtils.isSuccessResponse(apduResponse)) {
                return new UnknownDAError(
                  `Unexpected device response: ${bufferToHexaString(
                    apduResponse.statusCode,
                  )}`,
                );
              }
              return null;
            },
          });

          if (error) {
            throw error;
          }

          subscriber.next({
            type: "progress",
            progress: (i + 1) / apdus.length,
          });
        }
      };

      execute().then(
        () => subscriber.complete(),
        (err) => subscriber.error(err),
      );
    });
  }
}
