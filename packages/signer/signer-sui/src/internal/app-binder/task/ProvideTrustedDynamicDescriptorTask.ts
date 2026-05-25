import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";
import { BlockProtocolTask } from "@internal/app-binder/task/BlockProtocolTask";

const SIGNATURE_TAG = 0x08;

export type DescriptorInput = {
  data: Uint8Array;
  signature: Uint8Array;
};

export type ProvideTrustedDynamicDescriptorTaskArgs = {
  descriptor: DescriptorInput;
};

function buildTlv(tag: number, value: Uint8Array): Uint8Array {
  if (value.length > 0xff) {
    throw new Error("TLV value length exceeds 255 bytes");
  }
  const result = new Uint8Array(2 + value.length);
  result[0] = tag;
  result[1] = value.length;
  result.set(value, 2);
  return result;
}

function buildDescriptorPayload(input: DescriptorInput): Uint8Array {
  const signatureTlv = buildTlv(SIGNATURE_TAG, input.signature);

  // descriptor = data + TLV(signature)
  const descriptor = new Uint8Array(input.data.length + signatureTlv.length);
  descriptor.set(input.data, 0);
  descriptor.set(signatureTlv, input.data.length);

  // [length (u16 LE)] [descriptor]
  const payload = new Uint8Array(2 + descriptor.length);
  new DataView(payload.buffer).setUint16(0, descriptor.length, true);
  payload.set(descriptor, 2);

  return payload;
}

/**
 * Provides trusted dynamic descriptor (token metadata) to the Sui Ledger app
 * for clear signing purposes (INS 0x22).
 */
export class ProvideTrustedDynamicDescriptorTask {
  constructor(
    private api: InternalApi,
    private args: ProvideTrustedDynamicDescriptorTaskArgs,
  ) {}

  async run(): Promise<CommandResult<void, SuiAppErrorCodes>> {
    const payload = buildDescriptorPayload(this.args.descriptor);

    const result = await new BlockProtocolTask(this.api, {
      cla: 0x00,
      ins: 0x22,
      p1: 0x00,
      p2: 0x00,
      params: [payload],
    }).run();

    if ("error" in result) {
      return result;
    }

    return CommandResultFactory({ data: undefined });
  }
}
