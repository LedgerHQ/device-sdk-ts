import {
  type AleoTransactionContextResult,
  type ContextModule,
} from "@ledgerhq/context-module";
import { type InternalApi } from "@ledgerhq/device-management-kit";

export type BuildAleoTokenContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly tokenInternalId: string;
  readonly programName?: string;
};

export class BuildAleoTokenContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildAleoTokenContextTaskArgs,
  ) {}

  async run(): Promise<AleoTransactionContextResult> {
    const { contextModule, tokenInternalId, programName } = this.args;
    const deviceState = this.api.getDeviceSessionState();

    return contextModule.getAleoContext({
      tokenInternalId,
      programName,
      deviceModelId: deviceState.deviceModelId,
    });
  }
}
