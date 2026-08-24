import { type PkiCertificate } from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  LoadCertificateCommand,
  type LoadCertificateErrorCodes,
} from "@ledgerhq/device-management-kit";

export async function loadCertificate(
  api: InternalApi,
  certificate: PkiCertificate,
): Promise<CommandResult<void, LoadCertificateErrorCodes>> {
  const result = await api.sendCommand(
    new LoadCertificateCommand({
      certificate: certificate.payload,
      keyUsage: certificate.keyUsageNumber,
    }),
  );
  if (!isSuccessCommandResult(result)) {
    return result;
  }
  return CommandResultFactory({ data: undefined });
}

/**
 * Loads the certificate when present, otherwise a no-op success. Every
 * context-provider handler needs exactly this "certificate is optional"
 * gate before streaming its descriptor.
 */
export async function loadCertificateIfPresent(
  api: InternalApi,
  certificate: PkiCertificate | undefined,
): Promise<CommandResult<void, LoadCertificateErrorCodes>> {
  if (!certificate) {
    return CommandResultFactory({ data: undefined });
  }
  return loadCertificate(api, certificate);
}
