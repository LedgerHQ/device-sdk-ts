import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type SuiAppVersion } from "@api/model/SuiAppVersion";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";
import { BlockProtocolTask } from "@internal/app-binder/task/BlockProtocolTask";

/**
 * GetVersion uses the block protocol with a single 1-byte payload,
 * matching the hw-app-sui reference implementation.
 */
export class GetVersionTask {
  constructor(private api: InternalApi) {}

  async run(): Promise<CommandResult<SuiAppVersion, SuiAppErrorCodes>> {
    const result = await new BlockProtocolTask(this.api, {
      cla: 0x00,
      ins: 0x00,
      p1: 0x00,
      p2: 0x00,
      params: [new Uint8Array(1)],
    }).run();

    if ("error" in result) {
      return result;
    }

    const data = result.data;
    if (data.length < 3) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "GetVersion response too short: expected at least 3 bytes",
        ),
      });
    }

    return CommandResultFactory({
      data: {
        major: data[0]!,
        minor: data[1]!,
        patch: data[2]!,
      },
    });
  }
}
