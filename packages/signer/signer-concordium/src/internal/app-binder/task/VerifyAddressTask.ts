import {
  AccountOwnershipError,
  type AccountOwnershipNetwork,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  LoadCertificateCommand,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type VerifyAddressErrorCodes } from "@api/app-binder/VerifyAddressDeviceActionTypes";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { GetPublicKeyCommand } from "@internal/app-binder/command/GetPublicKeyCommand";
import { SetTrustedNameCommand } from "@internal/app-binder/command/SetTrustedNameCommand";
import { AddressVerificationFailedError } from "@internal/app-binder/command/utils/AddressVerificationFailedError";
import { TrustedMetadataServiceError } from "@internal/app-binder/command/utils/TrustedMetadataServiceError";
import { VerifyAddressCommand } from "@internal/app-binder/command/VerifyAddressCommand";

export type VerifyAddressTaskArgs = {
  readonly derivationPath: string;
  readonly address: string;
  readonly network: AccountOwnershipNetwork;
  readonly contextModule: ContextModule;
};

export class VerifyAddressTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: VerifyAddressTaskArgs,
    private readonly logger: LoggerPublisherService,
  ) {}

  async run(): Promise<CommandResult<true, VerifyAddressErrorCodes>> {
    const { derivationPath, address, network, contextModule } = this.args;

    // Step 1: Get public key (without device confirmation)
    this.logger.debug("[run] Getting public key");
    const pubKeyResult = await this.api.sendCommand(
      new GetPublicKeyCommand({
        derivationPath,
        checkOnDevice: false,
        skipOpenApp: true,
      }),
    );

    if (!isSuccessCommandResult(pubKeyResult)) {
      this.logger.error("[run] Failed to get public key", {
        data: { error: pubKeyResult.error },
      });
      return CommandResultFactory({ error: pubKeyResult.error });
    }

    const publicKeyHex = bufferToHexaString(pubKeyResult.data.publicKey, false);

    // Step 2: Get challenge from device
    this.logger.debug("[run] Getting challenge");
    const challengeResult = await this.api.sendCommand(
      new GetChallengeCommand(),
    );

    if (!isSuccessCommandResult(challengeResult)) {
      this.logger.error("[run] Failed to get challenge", {
        data: { error: challengeResult.error },
      });
      return CommandResultFactory({ error: challengeResult.error });
    }

    const challenge = challengeResult.data.challenge;

    // Step 3: Fetch account ownership context from trusted metadata service
    this.logger.debug("[run] Fetching account ownership context", {
      data: { publicKey: publicKeyHex, address, network },
    });

    const deviceModelId = this.api.getDeviceModel().id;
    let contexts: Awaited<ReturnType<ContextModule["getContexts"]>>;
    try {
      contexts = await contextModule.getContexts(
        {
          publicKey: publicKeyHex,
          address,
          challenge,
          network,
          deviceModelId,
        },
        [ClearSignContextType.CONCORDIUM_ACCOUNT_OWNERSHIP],
      );
    } catch (error) {
      this.logger.error("[run] Context module error", { data: { error } });
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Failed to fetch account ownership context: ${error instanceof Error ? error.message : "unknown error"}`,
        ),
      });
    }

    const ownershipContext = contexts.find(
      (
        c,
      ): c is ClearSignContextSuccess<ClearSignContextType.CONCORDIUM_ACCOUNT_OWNERSHIP> =>
        c.type === ClearSignContextType.CONCORDIUM_ACCOUNT_OWNERSHIP,
    );

    if (!ownershipContext) {
      const errorCtx = contexts.find(
        (c) => c.type === ClearSignContextType.ERROR,
      );
      if (errorCtx && "error" in errorCtx) {
        const err = errorCtx.error;
        if (
          err instanceof AccountOwnershipError &&
          err.kind === "verification_failed"
        ) {
          return CommandResultFactory({
            error: new AddressVerificationFailedError(err.message),
          });
        }
        return CommandResultFactory({
          error: new TrustedMetadataServiceError(err.message),
        });
      }
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "No account ownership context returned",
        ),
      });
    }

    // Step 4: Load PKI certificate on device
    if (ownershipContext.certificate) {
      this.logger.debug("[run] Loading PKI certificate");
      const certResult = await this.api.sendCommand(
        new LoadCertificateCommand({
          keyUsage: ownershipContext.certificate.keyUsageNumber,
          certificate: ownershipContext.certificate.payload,
        }),
      );

      if (!isSuccessCommandResult(certResult)) {
        this.logger.error("[run] Failed to load certificate", {
          data: { error: certResult.error },
        });
        return CommandResultFactory({ error: certResult.error });
      }
    }

    // Step 5: Set trusted name descriptor on device
    this.logger.debug("[run] Setting trusted name descriptor");
    const descriptorBytes = hexaStringToBuffer(ownershipContext.payload);

    if (!descriptorBytes || descriptorBytes.length === 0) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid descriptor payload"),
      });
    }

    const trustedNameResult = await this.api.sendCommand(
      new SetTrustedNameCommand({ payload: descriptorBytes }),
    );

    if (!isSuccessCommandResult(trustedNameResult)) {
      this.logger.error("[run] Failed to set trusted name", {
        data: { error: trustedNameResult.error },
      });
      return CommandResultFactory({ error: trustedNameResult.error });
    }

    // Step 6: Verify address on device (user approval)
    this.logger.debug("[run] Sending verify address command");
    const verifyResult = await this.api.sendCommand(
      new VerifyAddressCommand({ derivationPath }),
    );

    if (!isSuccessCommandResult(verifyResult)) {
      this.logger.error("[run] Failed to verify address", {
        data: { error: verifyResult.error },
      });
      return CommandResultFactory({ error: verifyResult.error });
    }

    return CommandResultFactory({ data: true as const });
  }
}
