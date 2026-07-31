import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";

export function getEmulatorBaseUrl(config: SpeculinhoConfig): string {
  if (!config.resolvedUrl) {
    throw new Error(
      "Emulator URL not yet resolved – did SpeculinhoServiceController.start() run?",
    );
  }
  return config.resolvedUrl;
}
