import {
  BlindSigningMethod,
  type BlindSigningReportParams,
  BlindSignReason,
  ClearSignContextType,
  type ContextModule,
  mapDeviceModelId,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { generateSignatureId } from "@ledgerhq/signer-utils";

const METADATA_ONLY_CONTEXT_TYPES = new Set<ClearSignContextType>([
  ClearSignContextType.TRANSACTION_CHECK,
  ClearSignContextType.DYNAMIC_NETWORK,
  ClearSignContextType.DYNAMIC_NETWORK_ICON,
  ClearSignContextType.GATED_SIGNING,
]);

export type BlindSigningDetectionInput = {
  type: "transaction" | "typedData";
  hasContext: boolean;
  contextTypes?: ClearSignContextType[];
  usedFallback: boolean;
  chainId: number | null;
  targetAddress: string | null;
  deviceModelId: DeviceModelId;
  signerAppVersion: string;
  deviceVersion: string | null;
};

export type BlindSigningDetectionTaskArgs = {
  input: BlindSigningDetectionInput;
  contextModule: ContextModule;
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export type BlindSigningDetectionTaskResult = {
  isBlindSign: boolean;
};

export function computeIsBlindSign(input: BlindSigningDetectionInput): boolean {
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
    ethContext: null,
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

    return { isBlindSign };
  }
}
