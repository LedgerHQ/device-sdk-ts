import {
  BlindSigningMethod,
  type BlindSigningReportParams,
  BlindSignReason,
  ClearSignContextType,
  type ContextModule,
  type EthSignReportParams,
  mapDeviceModelId,
  SigningMethod,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { generateSignatureId } from "@ledgerhq/signer-utils";

import { type ClearSigningType } from "@api/model/ClearSigningType";

const METADATA_ONLY_CONTEXT_TYPES = new Set<ClearSignContextType>([
  ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
  ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK,
  ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON,
  ClearSignContextType.ETHEREUM_GATED_SIGNING,
]);

export type BlindSigningDetectionInput = {
  type: "transaction" | "typedData";
  hasContext: boolean;
  contextTypes?: ClearSignContextType[];
  usedFallback: boolean;
  chainId: number | null;
  targetAddress: string | null;
  selectorId?: string | null;
  deviceModelId: DeviceModelId;
  signerAppVersion: string;
  deviceVersion: string | null;
  clearSigningType: ClearSigningType | null;
  partialContextErrors: number;
};

export type BlindSigningDetectionTaskArgs = {
  input: BlindSigningDetectionInput;
  contextModule: ContextModule;
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export type BlindSigningDetectionTaskResult = {
  isBlindSign: boolean;
};

function computeIsBlindSign(input: BlindSigningDetectionInput): boolean {
  if (input.usedFallback) {
    return true;
  }
  if (input.contextTypes && input.hasContext && input.contextTypes.length > 0) {
    const hasClearSignContexts = input.contextTypes.some(
      (type) => !METADATA_ONLY_CONTEXT_TYPES.has(type),
    );
    if (!hasClearSignContexts) {
      return true;
    }
  }
  return !input.hasContext;
}

function computeBlindSignReason(
  input: BlindSigningDetectionInput,
): BlindSignReason {
  if (input.usedFallback) {
    return BlindSignReason.DEVICE_REJECTED_CONTEXT;
  }
  return BlindSignReason.NO_CLEAR_SIGNING_CONTEXT;
}

function buildReportParams(
  input: BlindSigningDetectionInput,
  isBlindSign: boolean,
): BlindSigningReportParams {
  const signingMethod =
    input.type === "transaction"
      ? BlindSigningMethod.ETH_SIGN_TRANSACTION
      : BlindSigningMethod.ETH_SIGN_TYPED_DATA;

  return {
    signatureId: generateSignatureId(),
    signingMethod,
    isBlindSign,
    chainId: input.chainId,
    targetAddress: input.targetAddress,
    blindSignReason: isBlindSign ? computeBlindSignReason(input) : null,
    modelId: mapDeviceModelId(input.deviceModelId),
    signerAppVersion: input.signerAppVersion,
    deviceVersion: input.deviceVersion,
    ethContext:
      input.clearSigningType !== null
        ? {
            clearSigningType: input.clearSigningType,
            partialContextErrors: input.partialContextErrors,
          }
        : null,
  };
}

function buildSignReportParams(
  input: BlindSigningDetectionInput,
  isBlindSign: boolean,
): EthSignReportParams {
  const signingMethod =
    input.type === "transaction"
      ? SigningMethod.ETH_SIGN_TRANSACTION
      : SigningMethod.ETH_SIGN_TYPED_DATA;

  return {
    chain: "ETH",
    signatureId: generateSignatureId(),
    signingMethod,
    isBlindSign,
    chainId: input.chainId,
    targetAddress: input.targetAddress,
    blindSignReason: isBlindSign ? computeBlindSignReason(input) : null,
    modelId: mapDeviceModelId(input.deviceModelId),
    signerAppVersion: input.signerAppVersion,
    deviceVersion: input.deviceVersion,
    ...(input.selectorId !== undefined && { selectorId: input.selectorId }),
    ...(input.clearSigningType !== null && {
      clearSigningType: input.clearSigningType,
      partialContextErrors: input.partialContextErrors,
    }),
  };
}

export class BlindSigningDetectionTask {
  private readonly _logger: LoggerPublisherService;

  constructor(private readonly _args: BlindSigningDetectionTaskArgs) {
    this._logger = _args.loggerFactory("BlindSigningDetectionTask");
  }

  async run(): Promise<BlindSigningDetectionTaskResult> {
    const { input, contextModule } = this._args;

    const isBlindSign = computeIsBlindSign(input);

    this._logger.debug("[run] Blind signing detection result", {
      data: { isBlindSign, type: input.type },
    });

    try {
      const params = buildReportParams(input, isBlindSign);
      await contextModule.report(params);
    } catch (error) {
      this._logger.error("[run] Failed to report blind signing event", {
        data: { error },
      });
    }

    try {
      const signParams = buildSignReportParams(input, isBlindSign);
      await contextModule.signReport?.(signParams);
    } catch (error) {
      this._logger.error("[run] Failed to report signing event", {
        data: { error },
      });
    }

    return { isBlindSign };
  }
}
