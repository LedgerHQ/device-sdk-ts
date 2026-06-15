/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import { CommandResultFactory } from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideInstructionInfoCommand } from "@internal/app-binder/command/ProvideInstructionInfoCommand";
import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";
import { SignMessageGenericPreviewCommand } from "@internal/app-binder/command/SignMessageGenericPreviewCommand";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";

import { ProvideGenericClearSignContextTask } from "./ProvideGenericClearSignContextTask";

const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 11 } as const;
const success = CommandResultFactory({ data: undefined });

function tokenInfoContext(): ClearSignContext {
  return {
    type: ClearSignContextType.SOLANA_TOKEN_INFO,
    payload: { mint: "M", descriptor: { data: "aabb", signature: "cc" } },
    certificate: cert,
  } as any;
}

function instructionInfoContext(): ClearSignContext {
  return {
    type: ClearSignContextType.SOLANA_INSTRUCTION_INFO,
    payload: {
      programId: "P",
      discriminator: "0102",
      instructionInfo: { data: "aabb", signature: "00" },
      substructures: [],
      enumVariants: [],
    },
    certificate: cert,
  } as any;
}

function makeTask(
  poolContexts: ClearSignContext[],
  instructionInfoContexts: ClearSignContext[],
) {
  const api = { sendCommand: vi.fn().mockResolvedValue(success) };
  const task = new ProvideGenericClearSignContextTask(api as any, {
    derivationPath: "44'/501'/0'",
    transaction: new Uint8Array([1, 2, 3]),
    poolContexts,
    instructionInfoContexts,
    loggerFactory: () =>
      ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) as any,
    normaliser: {} as any,
  });
  return { task, api };
}

describe("ProvideGenericClearSignContextTask", () => {
  let api: { sendCommand: Mock };

  beforeEach(() => vi.clearAllMocks());

  it("streams GENERIC PREVIEW first, then Phase A pool, then Phase B templates", async () => {
    const made = makeTask([tokenInfoContext()], [instructionInfoContext()]);
    api = made.api;

    await made.task.run();

    const sent = api.sendCommand.mock.calls.map((c) => c[0]);
    expect(sent[0]).toBeInstanceOf(SignMessageGenericPreviewCommand);
    const previewIdx = 0;
    const tokenIdx = sent.findIndex(
      (c) => c instanceof ProvideTLVTransactionInstructionDescriptorCommand,
    );
    const infoIdx = sent.findIndex(
      (c) => c instanceof ProvideInstructionInfoCommand,
    );
    expect(tokenIdx).toBeGreaterThan(previewIdx);
    expect(infoIdx).toBeGreaterThan(tokenIdx); // Phase B after Phase A
  });

  it("streams the GENERIC PREVIEW with the blockhash zeroed", async () => {
    const zeroed = new Uint8Array([9, 9, 9]);
    const zeroSpy = vi
      .spyOn(BlockhashService.prototype, "zeroBlockhash")
      .mockReturnValue(zeroed);
    const made = makeTask([], []);

    await made.task.run();

    expect(zeroSpy).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    const preview = made.api.sendCommand.mock.calls
      .map((c) => c[0])
      .find((c) => c instanceof SignMessageGenericPreviewCommand) as any;
    // The streamed payload is `[signers, pathCount, ...paths, ...tx]`; its tail
    // is the zeroed transaction, not the original.
    const msg: Uint8Array = preview.args.serializedMessage;
    expect(Array.from(msg.slice(-3))).toEqual([9, 9, 9]);

    zeroSpy.mockRestore();
  });

  it("aborts (throws) when the device rejects GENERIC PREVIEW", async () => {
    const made = makeTask([], []);
    made.api.sendCommand.mockResolvedValue(
      CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      }),
    );

    await expect(made.task.run()).rejects.toThrow(
      "device rejected SIGN MESSAGE GENERIC PREVIEW",
    );
  });
});
