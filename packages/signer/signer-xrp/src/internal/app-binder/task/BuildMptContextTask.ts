import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { MAX_MPT_DESCRIPTORS } from "@internal/app-binder/constants";
import { extractMptIssuanceIds } from "@internal/app-binder/services/extractMptIssuanceIds";

export type MptContext = ClearSignContextSuccess<ClearSignContextType.XRP_MPT>;

type BuildMptContextTaskArgs = {
  contextModule: ContextModule;
  transaction: Uint8Array;
  deviceModelId: DeviceModelId;
};

/**
 * Every case without a descriptor (no MPT in the transaction, an MPT CAL does
 * not know) gives an empty list: the app then shows the transaction without
 * the ticker, or blind signs it.
 */
export class BuildMptContextTask {
  constructor(private readonly args: BuildMptContextTaskArgs) {}

  async run(): Promise<MptContext[]> {
    const { contextModule, transaction, deviceModelId } = this.args;

    const mptIssuanceIds = extractMptIssuanceIds(transaction);
    if (mptIssuanceIds.length === 0) {
      return [];
    }

    const contexts = await contextModule.getContexts(
      { mptIssuanceIds, deviceModelId },
      [ClearSignContextType.XRP_MPT],
    );

    return contexts
      .filter(
        (context): context is MptContext =>
          context.type === ClearSignContextType.XRP_MPT,
      )
      .slice(0, MAX_MPT_DESCRIPTORS);
  }
}
