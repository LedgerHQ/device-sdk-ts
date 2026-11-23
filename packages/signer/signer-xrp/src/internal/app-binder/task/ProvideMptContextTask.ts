import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import {
  hexaStringToBuffer,
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";

import { ProvideMptDescriptorCommand } from "@internal/app-binder/command/ProvideMptDescriptorCommand";

type ProvideMptContextTaskArgs = {
  contexts: ClearSignContextSuccess[];
};

/**
 * Loads the certificate, then the descriptor, of each MPT. A refused one is
 * not an error: the app then signs without it, as if CAL had none.
 */
export class ProvideMptContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideMptContextTaskArgs,
  ) {}

  async run(): Promise<void> {
    for (const context of this.args.contexts) {
      if (context.type !== ClearSignContextType.XRP_MPT) {
        continue;
      }
      const { payload, certificate } = context;
      const descriptor = hexaStringToBuffer(payload);
      if (descriptor === null || descriptor.length === 0) {
        continue;
      }

      if (certificate) {
        const loaded = await this.api.sendCommand(
          new LoadCertificateCommand({
            certificate: certificate.payload,
            keyUsage: certificate.keyUsageNumber,
          }),
        );
        if (!isSuccessCommandResult(loaded)) {
          continue;
        }
      }

      await this.api.sendCommand(
        new ProvideMptDescriptorCommand({ descriptor }),
      );
    }
  }
}
