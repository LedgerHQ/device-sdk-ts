import { type PkiCertificate } from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";

export async function loadCertificate(
  api: InternalApi,
  certificate: PkiCertificate,
  errorMessage: string,
): Promise<void> {
  const result = await api.sendCommand(
    new LoadCertificateCommand({
      certificate: certificate.payload,
      keyUsage: certificate.keyUsageNumber,
    }),
  );
  if (!isSuccessCommandResult(result)) {
    throw new Error(errorMessage);
  }
}
