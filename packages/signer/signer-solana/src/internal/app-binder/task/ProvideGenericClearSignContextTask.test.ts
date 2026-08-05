/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { ProvideInstructionInfoCommand } from "@internal/app-binder/command/ProvideInstructionInfoCommand";
import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";
import { SignMessageGenericPreviewCommand } from "@internal/app-binder/command/SignMessageGenericPreviewCommand";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";

import { type ChallengeBoundRequirements } from "./BuildGenericClearSignContextTask";
import { ProvideGenericClearSignContextTask } from "./ProvideGenericClearSignContextTask";

const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 11 } as const;
const success = CommandResultFactory({ data: undefined });
const challenge = CommandResultFactory({ data: { challenge: "deadbeef" } });

const NO_CHALLENGE_BOUND: ChallengeBoundRequirements = {
  tokenAccountStates: [],
  altResolutions: [],
  trustedNames: [],
  tokenAmountAltRefs: [],
  mintAltRefs: [],
};

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
  challengeBoundRequirements: ChallengeBoundRequirements = NO_CHALLENGE_BOUND,
  getContexts: Mock = vi.fn(async () => []),
) {
  const api = {
    sendCommand: vi.fn(async (cmd: unknown) =>
      cmd instanceof GetChallengeCommand ? challenge : success,
    ),
    getDeviceSessionState: vi.fn(() => ({ deviceModelId: DeviceModelId.STAX })),
  };
  const contextModule = { getContexts } as any;
  const task = new ProvideGenericClearSignContextTask(api as any, {
    derivationPath: "44'/501'/0'",
    transaction: new Uint8Array([1, 2, 3]),
    poolContexts,
    instructionInfoContexts,
    challengeBoundRequirements,
    contextModule,
    loggerFactory: () =>
      ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) as any,
    normaliser: {} as any,
  });
  return { task, api, getContexts };
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

  it("fetches each challenge-bound descriptor with a fresh GET CHALLENGE, after the pool and before the templates", async () => {
    const made = makeTask(
      [tokenInfoContext()],
      [instructionInfoContext()],
      {
        tokenAccountStates: ["ACC1", "ACC2"],
        altResolutions: [{ altAddress: "ALT", entryIndex: 3 }],
        trustedNames: ["NAME"],
        tokenAmountAltRefs: [],
        mintAltRefs: [],
      },
      // Empty fetch: assert the challenge + fetch protocol, not handler internals.
      vi.fn(async () => []),
    );
    api = made.api;

    await made.task.run();

    // One GET CHALLENGE per challenge-bound requirement (2 + 1 + 1 = 4).
    const challengeCalls = api.sendCommand.mock.calls.filter(
      (c) => c[0] instanceof GetChallengeCommand,
    );
    expect(challengeCalls).toHaveLength(4);

    // Each fetch carries that fresh challenge and targets the right type.
    expect(made.getContexts).toHaveBeenCalledTimes(4);
    expect(made.getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [{ tokenAccount: "ACC1", challenge: "deadbeef" }],
      }),
      [ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE],
    );
    expect(made.getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [{ altAddress: "ALT", entryIndex: 3, challenge: "deadbeef" }],
      }),
      [ClearSignContextType.SOLANA_ALT_RESOLUTION],
    );
    expect(made.getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [
          {
            address: "NAME",
            challenge: "deadbeef",
            types: ["token", "smart_contract"],
            sources: ["crypto_asset_list"],
          },
        ],
      }),
      [ClearSignContextType.SOLANA_TRUSTED_NAME],
    );

    // Ordering: every GET CHALLENGE precedes the Phase B template stream.
    const sent = api.sendCommand.mock.calls.map((c) => c[0]);
    const lastChallengeIdx = sent.reduce(
      (acc, c, i) => (c instanceof GetChallengeCommand ? i : acc),
      -1,
    );
    const templateIdx = sent.findIndex(
      (c) => c instanceof ProvideInstructionInfoCommand,
    );
    expect(lastChallengeIdx).toBeGreaterThanOrEqual(0);
    expect(templateIdx).toBeGreaterThan(lastChallengeIdx);
  });

  it("skips a challenge-bound descriptor when GET CHALLENGE fails (best-effort, no throw)", async () => {
    const made = makeTask(
      [],
      [],
      {
        tokenAccountStates: ["ACC1"],
        altResolutions: [],
        trustedNames: [],
        tokenAmountAltRefs: [],
        mintAltRefs: [],
      },
      vi.fn(async () => []),
    );
    // Preview succeeds; GET CHALLENGE fails.
    made.api.sendCommand.mockImplementation(async (cmd: unknown) =>
      cmd instanceof GetChallengeCommand
        ? CommandResultFactory({
            error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
          })
        : success,
    );

    await expect(made.task.run()).resolves.toBeUndefined();
    // The descriptor was never fetched because the challenge failed.
    expect(made.getContexts).not.toHaveBeenCalled();
  });

  it("continues (no throw) when an optional descriptor fails, still streaming the structural templates", async () => {
    const made = makeTask([tokenInfoContext()], [instructionInfoContext()]);
    api = made.api;
    // Preview + GET CHALLENGE succeed, but the device rejects TOKEN_INFO
    // (an optional descriptor); the rest must still be streamed.
    made.api.sendCommand.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof GetChallengeCommand) return challenge;
      if (cmd instanceof ProvideTLVTransactionInstructionDescriptorCommand) {
        return CommandResultFactory({
          error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
        });
      }
      return success;
    });

    await expect(made.task.run()).resolves.toBeUndefined();

    // The structural instruction-info template was still streamed despite the
    // optional TOKEN_INFO failure.
    const sent = api.sendCommand.mock.calls.map((c) => c[0]);
    expect(sent.some((c) => c instanceof ProvideInstructionInfoCommand)).toBe(
      true,
    );
  });

  it("aborts (throws) when a structural descriptor (instruction info) fails", async () => {
    const made = makeTask([tokenInfoContext()], [instructionInfoContext()]);
    // Everything succeeds except the structural INSTRUCTION_INFO command.
    made.api.sendCommand.mockImplementation(async (cmd: unknown) => {
      if (cmd instanceof GetChallengeCommand) return challenge;
      if (cmd instanceof ProvideInstructionInfoCommand) {
        return CommandResultFactory({
          error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
        });
      }
      return success;
    });

    await expect(made.task.run()).rejects.toThrow(
      "device rejected INSTRUCTION_INFO",
    );
  });

  // --- New challenge-bound flows ---

  function altResolutionCtx(resolvedAddress: string): ClearSignContext {
    return {
      type: ClearSignContextType.SOLANA_ALT_RESOLUTION,
      payload: { resolvedAddress, descriptor: { data: "aa", signature: "bb" } },
      certificate: cert,
    } as any;
  }
  function tokenAccountStateCtx(mint: string): ClearSignContext {
    return {
      type: ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
      payload: { mint, descriptor: { data: "aa", signature: "bb" } },
      certificate: cert,
    } as any;
  }
  function tokenInfoCtxFor(mint: string): ClearSignContext {
    return {
      type: ClearSignContextType.SOLANA_TOKEN_INFO,
      payload: { mint, descriptor: { data: "aa", signature: "bb" } },
      certificate: cert,
    } as any;
  }

  it("tokenAccountStates: after streaming TOKEN_ACCOUNT_STATE, fetches and streams TOKEN_INFO for the returned mint", async () => {
    const getContexts = vi.fn(
      async (_input: any, types: ClearSignContextType[]) => {
        if (types[0] === ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE)
          return [tokenAccountStateCtx("MINT1")];
        if (types[0] === ClearSignContextType.SOLANA_TOKEN_INFO)
          return [tokenInfoCtxFor("MINT1")];
        return [];
      },
    );
    const { task } = makeTask(
      [],
      [],
      { ...NO_CHALLENGE_BOUND, tokenAccountStates: ["ATA1"] },
      getContexts,
    );

    await task.run();

    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [expect.objectContaining({ tokenAccount: "ATA1" })],
      }),
      [ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE],
    );
    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({ mints: ["MINT1"] }),
      [ClearSignContextType.SOLANA_TOKEN_INFO],
    );
  });

  it("mintAltRefs: streams ALT_RESOLUTION then fetches TOKEN_INFO for the resolved address", async () => {
    const getContexts = vi.fn(
      async (_input: any, types: ClearSignContextType[]) => {
        if (types[0] === ClearSignContextType.SOLANA_ALT_RESOLUTION)
          return [altResolutionCtx("MINT2")];
        if (types[0] === ClearSignContextType.SOLANA_TOKEN_INFO)
          return [tokenInfoCtxFor("MINT2")];
        return [];
      },
    );
    const { task } = makeTask(
      [],
      [],
      {
        ...NO_CHALLENGE_BOUND,
        mintAltRefs: [{ altAddress: "ALT1", entryIndex: 0 }],
      },
      getContexts,
    );

    await task.run();

    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [
          expect.objectContaining({ altAddress: "ALT1", entryIndex: 0 }),
        ],
      }),
      [ClearSignContextType.SOLANA_ALT_RESOLUTION],
    );
    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({ mints: ["MINT2"] }),
      [ClearSignContextType.SOLANA_TOKEN_INFO],
    );
  });

  it("tokenAmountAltRefs: tries TOKEN_INFO first; on miss falls back to TOKEN_ACCOUNT_STATE + TOKEN_INFO", async () => {
    // ALT resolves to "ATA2" (an ATA, not a mint). TOKEN_INFO for "ATA2" misses;
    // TOKEN_ACCOUNT_STATE returns mint "MINT3"; TOKEN_INFO for "MINT3" succeeds.
    const getContexts = vi.fn(
      async (input: any, types: ClearSignContextType[]) => {
        if (types[0] === ClearSignContextType.SOLANA_ALT_RESOLUTION)
          return [altResolutionCtx("ATA2")];
        if (types[0] === ClearSignContextType.SOLANA_TOKEN_INFO)
          return input?.mints?.[0] === "MINT3"
            ? [tokenInfoCtxFor("MINT3")]
            : [];
        if (types[0] === ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE)
          return [tokenAccountStateCtx("MINT3")];
        return [];
      },
    );
    const { task } = makeTask(
      [],
      [],
      {
        ...NO_CHALLENGE_BOUND,
        tokenAmountAltRefs: [{ altAddress: "ALT2", entryIndex: 1 }],
      },
      getContexts,
    );

    await task.run();

    // ALT_RESOLUTION fetched for the ALT ref
    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [
          expect.objectContaining({ altAddress: "ALT2", entryIndex: 1 }),
        ],
      }),
      [ClearSignContextType.SOLANA_ALT_RESOLUTION],
    );
    // TOKEN_INFO attempted first for resolved address "ATA2" (optimistic mint path)
    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({ mints: ["ATA2"] }),
      [ClearSignContextType.SOLANA_TOKEN_INFO],
    );
    // TOKEN_ACCOUNT_STATE fallback for "ATA2"
    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({
        requests: [expect.objectContaining({ tokenAccount: "ATA2" })],
      }),
      [ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE],
    );
    // TOKEN_INFO fetched for the attested mint "MINT3"
    expect(getContexts).toHaveBeenCalledWith(
      expect.objectContaining({ mints: ["MINT3"] }),
      [ClearSignContextType.SOLANA_TOKEN_INFO],
    );
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
