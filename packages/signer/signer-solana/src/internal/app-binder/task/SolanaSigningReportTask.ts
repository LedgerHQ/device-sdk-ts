import {
  BlindSignReason,
  type ContextModule,
  mapDeviceModelId,
  SigningMethod,
  type SolSignReportParams,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { generateSignatureId } from "@ledgerhq/signer-utils";

import {
  COMPUTE_BUDGET_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
} from "@internal/app-binder/constants";
import { TransactionParser } from "@internal/app-binder/services/utils/TransactionParser";

export type SolanaSigningReportTaskArgs = {
  isBlindSign: boolean;
  messageBytes: Uint8Array;
  unrecognizedProgramIds: string[];
  contextModule: ContextModule;
  signerAppVersion: string;
  deviceModelId: DeviceModelId;
  deviceVersion: string | null;
  loggerFactory: (tag: string) => LoggerPublisherService;
};

export class SolanaSigningReportTask {
  private readonly logger: LoggerPublisherService;

  constructor(private readonly args: SolanaSigningReportTaskArgs) {
    this.logger = args.loggerFactory("SolanaSigningReportTask");
  }

  async run(): Promise<void> {
    try {
      const { allProgramIds, targetAddress } = await this.extractProgramIds();
      const params: SolSignReportParams = {
        chain: "SOL",
        signatureId: generateSignatureId(),
        signingMethod: SigningMethod.SOL_SIGN_TRANSACTION,
        isBlindSign: this.args.isBlindSign,
        targetAddress,
        blindSignReason: this.computeBlindSignReason(),
        programIds: allProgramIds,
        unrecognizedPrograms: this.args.unrecognizedProgramIds,
        modelId: mapDeviceModelId(this.args.deviceModelId),
        signerAppVersion: this.args.signerAppVersion,
        deviceVersion: this.args.deviceVersion,
        sessionId: null,
      };
      await this.args.contextModule.signReport?.(params);
    } catch (error) {
      this.logger.error("[run] Failed to report signing event", {
        data: { error },
      });
    }
  }

  private async extractProgramIds(): Promise<{
    allProgramIds: string[];
    targetAddress: string | null;
  }> {
    const parsed = await new TransactionParser()
      .parse(this.args.messageBytes)
      .run();

    if (parsed.isLeft()) {
      return { allProgramIds: [], targetAddress: null };
    }

    const message = parsed.unsafeCoerce().message;
    const programIds = Array.from(
      new Set(
        message.compiledInstructions
          .map((ix) => message.allKeys[ix.programIdIndex]?.toBase58() ?? "")
          .filter((id) => id !== COMPUTE_BUDGET_PROGRAM_ID && id !== ""),
      ),
    );
    const targetAddress =
      programIds.find((id) => id !== SYSTEM_PROGRAM_ID) ?? null;

    return { allProgramIds: programIds, targetAddress };
  }

  private computeBlindSignReason(): BlindSignReason | null {
    if (!this.args.isBlindSign) return null;
    if (this.args.unrecognizedProgramIds.length > 0) {
      return BlindSignReason.UNRECOGNIZED_PROGRAM;
    }
    return BlindSignReason.NO_CLEAR_SIGNING_CONTEXT;
  }
}
