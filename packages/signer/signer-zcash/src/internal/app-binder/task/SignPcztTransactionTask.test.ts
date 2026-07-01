import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessDmkResult,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PcztTransaction } from "@api/model/PcztTransaction";
import { INS_PCZT_HEADER } from "@internal/app-binder/command/PcztHeaderCommand";
import { INS_PCZT_ORCHARD_ACTION } from "@internal/app-binder/command/PcztOrchardActionCommand";
import { INS_PCZT_TRANSPARENT_INPUT } from "@internal/app-binder/command/PcztTransparentInputCommand";
import { INS_PCZT_TRANSPARENT_OUTPUT } from "@internal/app-binder/command/PcztTransparentOutputCommand";
import { INS_PCZT_SIGN_ORCHARD } from "@internal/app-binder/command/SignPcztOrchardCommand";
import { INS_PCZT_SIGN_TRANSPARENT } from "@internal/app-binder/command/SignPcztTransparentCommand";
import { PCZT_P2 } from "@internal/app-binder/command/utils/apduHeaderUtils";
import {
  privateToPrivateTransaction,
  privateToPublicTransaction,
  publicToPrivateTransaction,
  publicToPublicTransaction,
} from "@internal/app-binder/task/__fixtures__/pcztFixtures";

import { SignPcztTransactionTask } from "./SignPcztTransactionTask";

type Call = { name: string; ins: number; p1: number; p2: number };

/** Minimal shape of the commands the task sends, for inspection in the mock. */
type CapturedCommand = {
  name: string;
  getApdu: () => { getRawApdu: () => Uint8Array };
};

describe("SignPcztTransactionTask", () => {
  let apiMock: InternalApi;
  let calls: Call[];

  beforeEach(() => {
    calls = [];
    apiMock = { sendCommand: vi.fn() } as unknown as InternalApi;
    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      const cmd = command as CapturedCommand;
      const raw: Uint8Array = cmd.getApdu().getRawApdu();
      calls.push({ name: cmd.name, ins: raw[1]!, p1: raw[2]!, p2: raw[3]! });
      if (cmd.name === "SignPcztOrchard") {
        // spendAuthSig keyed on the action index (P2) so order is verifiable.
        return Promise.resolve(
          CommandResultFactory({
            data: { spendAuthSig: new Uint8Array(64).fill(raw[3]!) },
          }),
        );
      }
      if (cmd.name === "SignPcztTransparent") {
        return Promise.resolve(
          CommandResultFactory({
            data: { signature: Uint8Array.of(0x30, raw[3]!, 0x01) },
          }),
        );
      }
      return Promise.resolve(CommandResultFactory({ data: undefined }));
    });
  });

  const run = (transaction: PcztTransaction) =>
    new SignPcztTransactionTask(apiMock, { transaction }).run();

  it("streams HEADER, transparent in/out, then ORCHARD in fixed order", async () => {
    await run(publicToPublicTransaction());

    const bundleIns = calls
      .filter((c) =>
        [
          INS_PCZT_HEADER,
          INS_PCZT_TRANSPARENT_INPUT,
          INS_PCZT_TRANSPARENT_OUTPUT,
          INS_PCZT_ORCHARD_ACTION,
        ].includes(c.ins as never),
      )
      .map((c) => c.ins);

    // header first; the three bundle sections strictly increasing INS groups.
    expect(bundleIns[0]).toBe(INS_PCZT_HEADER);
    const firstInput = bundleIns.indexOf(INS_PCZT_TRANSPARENT_INPUT);
    const firstOutput = bundleIns.indexOf(INS_PCZT_TRANSPARENT_OUTPUT);
    const firstOrchard = bundleIns.indexOf(INS_PCZT_ORCHARD_ACTION);
    expect(firstInput).toBeLessThan(firstOutput);
    expect(firstOutput).toBeLessThan(firstOrchard);
  });

  it("finalizes the PCZT with P2_FINISHED on the last ORCHARD packet only", async () => {
    await run(privateToPrivateTransaction());

    const orchardPackets = calls.filter(
      (c) => c.ins === INS_PCZT_ORCHARD_ACTION,
    );
    const finished = orchardPackets.filter((c) => c.p2 === PCZT_P2.FINISHED);
    expect(finished).toHaveLength(1);
    expect(orchardPackets[orchardPackets.length - 1]!.p2).toBe(
      PCZT_P2.FINISHED,
    );
    // no bundle packet finalizes before the last Orchard packet.
    orchardPackets
      .slice(0, -1)
      .forEach((c) => expect(c.p2).toBe(PCZT_P2.CONTINUE));
  });

  it("collects one spendAuthSig per Orchard action and no bindingSig", async () => {
    const result = await run(privateToPrivateTransaction());

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.orchard).toHaveLength(1);
      expect(result.data.orchard[0]!.spendAuthSig).toEqual(
        new Uint8Array(64).fill(0x00),
      ); // action index 0
      expect(result.data.transparentInputSigs).toHaveLength(0);
    }
    // SIGN_ORCHARD issued once, with P2 = action index 0.
    const orchardSigns = calls.filter(
      (c) => c.ins === INS_PCZT_SIGN_ORCHARD,
    );
    expect(orchardSigns).toHaveLength(1);
    expect(orchardSigns[0]!.p2).toBe(0);
    expect(calls.some((c) => c.ins === INS_PCZT_SIGN_TRANSPARENT)).toBe(false);
  });

  it("collects one secp256k1 signature per transparent input", async () => {
    const result = await run(publicToPublicTransaction());

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.transparentInputSigs).toHaveLength(1);
      expect(result.data.transparentInputSigs[0]).toEqual(
        Uint8Array.of(0x30, 0x00, 0x01),
      ); // input index 0
      expect(result.data.orchard).toHaveLength(0);
    }
    const transparentSigns = calls.filter(
      (c) => c.ins === INS_PCZT_SIGN_TRANSPARENT,
    );
    expect(transparentSigns).toHaveLength(1);
    expect(transparentSigns[0]!.p2).toBe(0);
  });

  it.each([
    ["public -> public", publicToPublicTransaction, 0, 1],
    ["private -> private", privateToPrivateTransaction, 1, 0],
    ["public -> private", publicToPrivateTransaction, 1, 1],
    ["private -> public", privateToPublicTransaction, 1, 0],
  ] as const)(
    "supports the %s transfer flow",
    async (_label, build, orchardCount, transparentCount) => {
      const result = await run(build());
      expect(isSuccessDmkResult(result)).toBe(true);
      if (isSuccessDmkResult(result)) {
        expect(result.data.orchard).toHaveLength(orchardCount);
        expect(result.data.transparentInputSigs).toHaveLength(transparentCount);
      }
    },
  );

  it("aborts and surfaces the error when a bundle command fails", async () => {
    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      const cmd = command as CapturedCommand;
      const raw: Uint8Array = cmd.getApdu().getRawApdu();
      calls.push({ name: cmd.name, ins: raw[1]!, p1: raw[2]!, p2: raw[3]! });
      return Promise.resolve(
        CommandResultFactory({
          error: new InvalidStatusWordError("header rejected"),
        }),
      );
    });

    const result = await run(privateToPrivateTransaction());

    expect(isSuccessDmkResult(result)).toBe(false);
    // failed on the very first command (HEADER); nothing else streamed.
    expect(calls).toHaveLength(1);
    expect(calls[0]!.ins).toBe(INS_PCZT_HEADER);
  });

  it("surfaces a device rejection during Orchard signing", async () => {
    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      const cmd = command as CapturedCommand;
      if (cmd.name === "SignPcztOrchard") {
        return Promise.resolve(
          CommandResultFactory({
            error: new InvalidStatusWordError("action rejected"),
          }),
        );
      }
      return Promise.resolve(CommandResultFactory({ data: undefined }));
    });

    const result = await run(privateToPrivateTransaction());
    expect(isSuccessDmkResult(result)).toBe(false);
  });
});
