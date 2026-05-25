import {
  AleoContextTypes,
  type AleoTransactionContextResult,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";

import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";

export type ProvideAleoTokenContextTaskArgs = {
  readonly aleoTransactionContext: AleoTransactionContextResult;
};

export class ProvideAleoTokenContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideAleoTokenContextTaskArgs,
  ) {}

  async run(): Promise<void> {
    const { loadersResults } = this.args.aleoTransactionContext;

    for (const loaderResult of loadersResults) {
      if (loaderResult.type !== AleoContextTypes.ALEO_TOKEN) {
        console.warn(
          "[ProvideAleoTokenContextTask] Skipping loader result of type:",
          loaderResult.type,
          "error" in loaderResult ? loaderResult.error : "",
        );
        continue;
      }

      const { certificate } = loaderResult;
      const { data, signature } = loaderResult.payload.aleoTokenDescriptor;

      if (!certificate) {
        console.warn(
          "[ProvideAleoTokenContextTask] Skipping ALEO_TOKEN entry: no PKI certificate available",
        );
        continue;
      }

      const certResult = await this.api.sendCommand(
        new LoadCertificateCommand({
          certificate: certificate.payload,
          keyUsage: certificate.keyUsageNumber,
        }),
      );

      if (!isSuccessCommandResult(certResult)) {
        throw new Error(
          "[SignerAleo] ProvideAleoTokenContextTask: Failed to load PKI certificate",
        );
      }

      await this.api.sendCommand(
        new ProvideTokenInformationCommand({
          dataHex: data,
          signatureHex: signature,
        }),
      );
    }
  }
}
