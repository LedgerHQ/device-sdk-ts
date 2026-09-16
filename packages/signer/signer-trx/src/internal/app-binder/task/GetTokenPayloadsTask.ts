import {
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";

import { MAX_TOKEN_FRAMES } from "@internal/app-binder/constants";

type GetTokenPayloadsTaskArgs = {
  contextModule: ContextModule;
  transaction: Uint8Array;
};

/**
 * A descriptor the device cannot verify makes it abort the whole signature, so
 * anything short of a complete, well-formed set is dropped: the device then
 * reviews the transaction without the token name.
 */
export class GetTokenPayloadsTask {
  constructor(private readonly args: GetTokenPayloadsTaskArgs) {}

  async run(): Promise<Uint8Array[]> {
    const contexts = await this.args.contextModule.getContexts(
      { rawTransaction: this.args.transaction },
      [ClearSignContextType.TRON_TOKEN],
    );

    const payloads: Uint8Array[] = [];
    for (const context of contexts) {
      const payload =
        context.type === ClearSignContextType.TRON_TOKEN
          ? hexaStringToBuffer(context.payload)
          : null;
      if (payload === null || payload.length === 0) {
        return [];
      }
      payloads.push(payload);
    }

    return payloads.length <= MAX_TOKEN_FRAMES ? payloads : [];
  }
}
