import {
  CommandResultFactory,
  type InternalApi,
  InvalidArgumentError,
  InvalidStatusWordError,
  isSuccessDmkResult,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PcztTransaction } from "@api/model/PcztTransaction";
import { INS_PCZT_HEADER } from "@internal/app-binder/command/PcztHeaderCommand";
import { INS_PCZT_IRONWOOD_ACTION } from "@internal/app-binder/command/PcztIronwoodActionCommand";
import { INS_PCZT_ORCHARD_ACTION } from "@internal/app-binder/command/PcztOrchardActionCommand";
import { INS_PCZT_TRANSPARENT_INPUT } from "@internal/app-binder/command/PcztTransparentInputCommand";
import { INS_PCZT_TRANSPARENT_OUTPUT } from "@internal/app-binder/command/PcztTransparentOutputCommand";
import { INS_PCZT_SIGN_IRONWOOD } from "@internal/app-binder/command/SignPcztIronwoodCommand";
import { INS_PCZT_SIGN_ORCHARD } from "@internal/app-binder/command/SignPcztOrchardCommand";
import { INS_PCZT_SIGN_TRANSPARENT } from "@internal/app-binder/command/SignPcztTransparentCommand";
import { PCZT_P2 } from "@internal/app-binder/command/utils/apduHeaderUtils";
import { OutputAccountRefusedError } from "@internal/app-binder/command/utils/OutputAccountRefusedError";
import { UnsupportedOutputAccountDeclarationError } from "@internal/app-binder/command/utils/UnsupportedOutputAccountDeclarationError";
import { ZcashAppCommandError } from "@internal/app-binder/command/utils/zcashApplicationErrors";
import {
  allDummyIronwoodBundle,
  allDummyOrchardBundle,
  mixedDummyOrchardBundle,
  multiRealDummyOrchardBundle,
  orchardTransactionDeclaringAccount,
  privateToPrivateTransaction,
  privateToPublicTransaction,
  publicToPrivateTransaction,
  publicToPublicTransaction,
  sampleIronwoodBundle,
  v6TransactionDeclaringAccounts,
  v6TransactionWithOrchardAndIronwood,
  v6TransactionWithTransparentOrchardAndIronwood,
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
      if (cmd.name === "SignPcztIronwood") {
        // spendAuthSig keyed on the action index (P2) + 0x10 offset to distinguish from Orchard.
        return Promise.resolve(
          CommandResultFactory({
            data: { spendAuthSig: new Uint8Array(64).fill(raw[3]! + 0x10) },
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
    const orchardSigns = calls.filter((c) => c.ins === INS_PCZT_SIGN_ORCHARD);
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

  it("signs only real spends and skips dummy padding actions", async () => {
    // Bundle order: dummy (0), real (1), dummy (2). Only index 1 is device-signed.
    const result = await run({
      ...privateToPrivateTransaction(),
      orchardBundle: mixedDummyOrchardBundle(),
    });

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.orchard).toHaveLength(1);
      // spendAuthSig is keyed on the signed action's index (P2) by the mock.
      expect(result.data.orchard[0]!.spendAuthSig).toEqual(
        new Uint8Array(64).fill(1),
      );
    }
    // All three actions are still streamed, but only the real spend is signed.
    expect(
      calls.filter((c) => c.ins === INS_PCZT_ORCHARD_ACTION).length,
    ).toBeGreaterThan(0);
    const orchardSigns = calls.filter((c) => c.ins === INS_PCZT_SIGN_ORCHARD);
    expect(orchardSigns).toHaveLength(1);
    expect(orchardSigns[0]!.p2).toBe(1);
  });

  it("signs multiple real spends in ascending action-index order, skipping dummies", async () => {
    // Bundle order: dummy (0), real (1), real (2), dummy (3). Indices 1 and 2
    // are device-signed, strictly in ascending order; the dummies are skipped.
    const result = await run({
      ...privateToPrivateTransaction(),
      orchardBundle: multiRealDummyOrchardBundle(),
    });

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.orchard).toHaveLength(2);
    }
    const orchardSigns = calls.filter((c) => c.ins === INS_PCZT_SIGN_ORCHARD);
    expect(orchardSigns.map((c) => c.p2)).toEqual([1, 2]);
  });

  it("requests no Orchard signature when every action is dummy padding", async () => {
    const result = await run({
      ...privateToPrivateTransaction(),
      orchardBundle: allDummyOrchardBundle(),
    });

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.orchard).toHaveLength(0);
    }
    expect(calls.some((c) => c.ins === INS_PCZT_SIGN_ORCHARD)).toBe(false);
  });

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

  // V6 / Ironwood tests

  it("V5 regression: FINISHED stays on last Orchard packet and no IRONWOOD APDUs sent", async () => {
    await run(privateToPrivateTransaction());

    const orchardPackets = calls.filter(
      (c) => c.ins === INS_PCZT_ORCHARD_ACTION,
    );
    // Last Orchard packet carries FINISHED.
    expect(orchardPackets[orchardPackets.length - 1]!.p2).toBe(
      PCZT_P2.FINISHED,
    );
    // No Ironwood APDUs are sent for a V5 transaction.
    expect(calls.some((c) => c.ins === INS_PCZT_IRONWOOD_ACTION)).toBe(false);
    expect(calls.some((c) => c.ins === INS_PCZT_SIGN_IRONWOOD)).toBe(false);
  });

  it("V6: FINISHED moves to last Ironwood packet; all Orchard packets use CONTINUE", async () => {
    await run(v6TransactionWithOrchardAndIronwood());

    const orchardPackets = calls.filter(
      (c) => c.ins === INS_PCZT_ORCHARD_ACTION,
    );
    const ironwoodPackets = calls.filter(
      (c) => c.ins === INS_PCZT_IRONWOOD_ACTION,
    );

    // All Orchard packets carry CONTINUE for V6.
    orchardPackets.forEach((c) => expect(c.p2).toBe(PCZT_P2.CONTINUE));
    // Last Ironwood packet carries FINISHED.
    expect(ironwoodPackets[ironwoodPackets.length - 1]!.p2).toBe(
      PCZT_P2.FINISHED,
    );
  });

  it("V6: APDU order — HEADER, inputs, outputs, ORCHARD, IRONWOOD, SIGN_ORCHARD, SIGN_IRONWOOD", async () => {
    await run(v6TransactionWithOrchardAndIronwood());

    const insSequence = calls.map((c) => c.ins);
    const lastOrchard = insSequence.lastIndexOf(INS_PCZT_ORCHARD_ACTION);
    const firstIronwood = insSequence.indexOf(INS_PCZT_IRONWOOD_ACTION);
    const lastIronwood = insSequence.lastIndexOf(INS_PCZT_IRONWOOD_ACTION);
    const firstSignOrchard = insSequence.indexOf(INS_PCZT_SIGN_ORCHARD);
    const firstSignIronwood = insSequence.indexOf(INS_PCZT_SIGN_IRONWOOD);

    // All Orchard streaming before any Ironwood streaming.
    expect(lastOrchard).toBeLessThan(firstIronwood);
    // All Ironwood streaming before any sign commands.
    expect(lastIronwood).toBeLessThan(firstSignOrchard);
    // Orchard signing before Ironwood signing.
    expect(firstSignOrchard).toBeLessThan(firstSignIronwood);
  });

  it("V6: collects one spendAuthSig per Ironwood action", async () => {
    const result = await run(v6TransactionWithOrchardAndIronwood());

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.ironwood).toHaveLength(1);
      // Mock keys spendAuthSig on P2 + 0x10.
      expect(result.data.ironwood[0]!.spendAuthSig).toEqual(
        new Uint8Array(64).fill(0x10),
      );
    }
    const ironwoodSigns = calls.filter((c) => c.ins === INS_PCZT_SIGN_IRONWOOD);
    expect(ironwoodSigns).toHaveLength(1);
    expect(ironwoodSigns[0]!.p2).toBe(0);
  });

  it("V6: returns error immediately when ironwoodBundle is null (V6 requires Ironwood)", async () => {
    const result = await run({
      ...v6TransactionWithOrchardAndIronwood(),
      ironwoodBundle: null,
    });

    expect(isSuccessDmkResult(result)).toBe(false);
    if (!isSuccessDmkResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidArgumentError);
    }
    // No APDUs sent — the guard fires before streaming.
    expect(calls).toHaveLength(0);
  });

  it("V5: returns error immediately when ironwoodBundle is non-null (V5 does not support Ironwood)", async () => {
    const result = await run({
      ...privateToPrivateTransaction(),
      ironwoodBundle: sampleIronwoodBundle(),
    });

    expect(isSuccessDmkResult(result)).toBe(false);
    if (!isSuccessDmkResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidArgumentError);
    }
    // No APDUs sent — the guard fires before streaming.
    expect(calls).toHaveLength(0);
  });

  it("V6: device rejection during Ironwood streaming returns error", async () => {
    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      const cmd = command as CapturedCommand;
      const raw: Uint8Array = cmd.getApdu().getRawApdu();
      calls.push({ name: cmd.name, ins: raw[1]!, p1: raw[2]!, p2: raw[3]! });
      if (cmd.name === "PcztIronwoodAction") {
        return Promise.resolve(
          CommandResultFactory({
            error: new InvalidStatusWordError("ironwood rejected"),
          }),
        );
      }
      if (cmd.name === "SignPcztOrchard") {
        return Promise.resolve(
          CommandResultFactory({
            data: { spendAuthSig: new Uint8Array(64).fill(0x00) },
          }),
        );
      }
      return Promise.resolve(CommandResultFactory({ data: undefined }));
    });

    const result = await run(v6TransactionWithOrchardAndIronwood());
    expect(isSuccessDmkResult(result)).toBe(false);
    // No SIGN_IRONWOOD issued after the streaming failure.
    expect(calls.some((c) => c.ins === INS_PCZT_SIGN_IRONWOOD)).toBe(false);
  });

  it("V6: device rejection during Ironwood signing returns error", async () => {
    vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
      const cmd = command as CapturedCommand;
      const raw: Uint8Array = cmd.getApdu().getRawApdu();
      calls.push({ name: cmd.name, ins: raw[1]!, p1: raw[2]!, p2: raw[3]! });
      if (cmd.name === "SignPcztIronwood") {
        return Promise.resolve(
          CommandResultFactory({
            error: new InvalidStatusWordError("ironwood sign rejected"),
          }),
        );
      }
      if (cmd.name === "SignPcztOrchard") {
        return Promise.resolve(
          CommandResultFactory({
            data: { spendAuthSig: new Uint8Array(64).fill(0x00) },
          }),
        );
      }
      return Promise.resolve(CommandResultFactory({ data: undefined }));
    });

    const result = await run(v6TransactionWithOrchardAndIronwood());
    expect(isSuccessDmkResult(result)).toBe(false);
  });

  it("V5 result includes empty ironwood array for backward compat", async () => {
    const result = await run(privateToPrivateTransaction());

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.ironwood).toHaveLength(0);
    }
  });

  it("V6: requests no Ironwood signature when every action is a dummy spend", async () => {
    const result = await run({
      ...v6TransactionWithOrchardAndIronwood(),
      ironwoodBundle: allDummyIronwoodBundle(),
    });

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.ironwood).toHaveLength(0);
    }
    expect(calls.some((c) => c.ins === INS_PCZT_SIGN_IRONWOOD)).toBe(false);
  });

  it("V6 + transparent: SIGN_TRANSPARENT comes after SIGN_IRONWOOD in APDU order", async () => {
    await run(v6TransactionWithTransparentOrchardAndIronwood());

    const insSequence = calls.map((c) => c.ins);
    const lastSignIronwood = insSequence.lastIndexOf(INS_PCZT_SIGN_IRONWOOD);
    const firstSignTransparent = insSequence.indexOf(INS_PCZT_SIGN_TRANSPARENT);

    expect(lastSignIronwood).not.toBe(-1);
    expect(firstSignTransparent).not.toBe(-1);
    // Transparent signing must follow all Ironwood signing.
    expect(lastSignIronwood).toBeLessThan(firstSignTransparent);
  });

  it("V6 + transparent: result includes both ironwood sigs and transparentInputSigs", async () => {
    const result = await run(v6TransactionWithTransparentOrchardAndIronwood());

    expect(isSuccessDmkResult(result)).toBe(true);
    if (isSuccessDmkResult(result)) {
      expect(result.data.ironwood).toHaveLength(1);
      expect(result.data.transparentInputSigs).toHaveLength(1);
      // Mock keys ironwood spendAuthSig on actionIndex (0) + 0x10 offset.
      expect(result.data.ironwood[0]!.spendAuthSig).toEqual(
        new Uint8Array(64).fill(0x10),
      );
    }
  });

  describe("output account declaration", () => {
    type Sent = { name: string; ins: number; data: Uint8Array };
    let sent: Sent[];

    const APP_CONFIG_INS = 0xc4;
    // Orchard/Ironwood metadata packet of the single action of the fixtures:
    // count, spend, zip32, cmx+epk, enc x3, out, metadata.
    const METADATA_PACKET = 8;

    /**
     * Device double: answers GetAppConfig with `version` (or `configError`),
     * and fails the `refuseAt`-th packet of a pool command with `refuse`.
     */
    const useDevice = (options: {
      version?: string;
      configError?: boolean;
      refuse?: { name: string; packet: number; code: "6a80" | "6a84" };
    }) => {
      sent = [];
      const counters: Record<string, number> = {};
      vi.mocked(apiMock.sendCommand).mockImplementation((command: unknown) => {
        const cmd = command as CapturedCommand;
        const raw = cmd.getApdu().getRawApdu();
        sent.push({ name: cmd.name, ins: raw[1]!, data: raw.slice(5) });
        if (cmd.name === "getAppConfig") {
          return Promise.resolve(
            options.configError
              ? CommandResultFactory({
                  error: new InvalidStatusWordError("config unreadable"),
                })
              : CommandResultFactory({
                  data: { version: options.version ?? "3.9.5" },
                }),
          );
        }
        const packet = counters[cmd.name] ?? 0;
        counters[cmd.name] = packet + 1;
        if (
          options.refuse &&
          options.refuse.name === cmd.name &&
          options.refuse.packet === packet
        ) {
          return Promise.resolve(
            CommandResultFactory({
              error: new ZcashAppCommandError({
                errorCode: options.refuse.code,
                message: "refused",
              }),
            }),
          );
        }
        if (cmd.name === "SignPcztOrchard" || cmd.name === "SignPcztIronwood") {
          return Promise.resolve(
            CommandResultFactory({
              data: { spendAuthSig: new Uint8Array(64).fill(raw[3]!) },
            }),
          );
        }
        return Promise.resolve(CommandResultFactory({ data: undefined }));
      });
    };

    const pczt = () => sent.filter((c) => c.name.startsWith("Pczt"));

    it("sends no GetAppConfig and the same stream when nothing is declared", async () => {
      useDevice({});
      await run(privateToPrivateTransaction());

      expect(sent.some((c) => c.ins === APP_CONFIG_INS)).toBe(false);
      expect(sent[0]!.ins).toBe(INS_PCZT_HEADER);
      const metadata = sent.filter((c) => c.ins === INS_PCZT_ORCHARD_ACTION)[
        METADATA_PACKET
      ]!;
      expect(metadata.data).toHaveLength(115);
    });

    it("checks the version first, then streams the extended Orchard metadata (V5)", async () => {
      useDevice({ version: "3.9.5" });
      const result = await run(orchardTransactionDeclaringAccount(1));

      expect(isSuccessDmkResult(result)).toBe(true);
      expect(sent[0]!.ins).toBe(APP_CONFIG_INS);
      expect(sent[1]!.ins).toBe(INS_PCZT_HEADER);
      const metadata = sent.filter((c) => c.ins === INS_PCZT_ORCHARD_ACTION)[
        METADATA_PACKET
      ]!;
      expect(metadata.data).toHaveLength(121);
      expect(Buffer.from(metadata.data.slice(115)).toString("hex")).toBe(
        "010401000000",
      );
      if (isSuccessDmkResult(result)) {
        expect(result.data.orchard).toHaveLength(1);
      }
    });

    it("streams the extended metadata on both pools (V6)", async () => {
      useDevice({ version: "3.10.0" });
      const result = await run(v6TransactionDeclaringAccounts(1, 2));

      expect(isSuccessDmkResult(result)).toBe(true);
      expect(sent[0]!.ins).toBe(APP_CONFIG_INS);
      const orchard = sent.filter((c) => c.ins === INS_PCZT_ORCHARD_ACTION)[
        METADATA_PACKET
      ]!;
      const ironwood = sent.filter((c) => c.ins === INS_PCZT_IRONWOOD_ACTION)[
        METADATA_PACKET
      ]!;
      expect(Buffer.from(orchard.data.slice(115)).toString("hex")).toBe(
        "010401000000",
      );
      expect(ironwood.data).toHaveLength(122);
      expect(Buffer.from(ironwood.data.slice(116)).toString("hex")).toBe(
        "010402000000",
      );
      if (isSuccessDmkResult(result)) {
        expect(result.data.ironwood).toHaveLength(1);
      }
    });

    it("refuses an app older than 3.9.5 before any transaction APDU", async () => {
      useDevice({ version: "3.9.4" });
      const result = await run(orchardTransactionDeclaringAccount(1));

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        expect(result.error).toBeInstanceOf(
          UnsupportedOutputAccountDeclarationError,
        );
        expect(
          (result.error as UnsupportedOutputAccountDeclarationError).appVersion,
        ).toBe("3.9.4");
      }
      expect(sent.map((c) => c.ins)).toEqual([APP_CONFIG_INS]);
      expect(pczt()).toHaveLength(0);
    });

    it("fails closed on an unreadable version", async () => {
      useDevice({ version: "ironwood" });
      const result = await run(orchardTransactionDeclaringAccount(1));

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        expect(result.error).toBeInstanceOf(
          UnsupportedOutputAccountDeclarationError,
        );
      }
      expect(pczt()).toHaveLength(0);
    });

    it("surfaces a GetAppConfig failure without sending the transaction", async () => {
      useDevice({ configError: true });
      const result = await run(orchardTransactionDeclaringAccount(1));

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
      expect(pczt()).toHaveLength(0);
    });

    it("rejects an invalid declaration before any APDU", async () => {
      useDevice({});
      // account 0 is the account being spent
      const result = await run(orchardTransactionDeclaringAccount(0));

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidArgumentError);
      }
      expect(sent).toHaveLength(0);
    });

    it("reports a 6a80 on a declared Orchard metadata packet as OutputAccountRefusedError", async () => {
      useDevice({
        refuse: {
          name: "PcztOrchardAction",
          packet: METADATA_PACKET,
          code: "6a80",
        },
      });
      const result = await run(orchardTransactionDeclaringAccount(7));

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        const error = result.error as OutputAccountRefusedError;
        expect(error).toBeInstanceOf(OutputAccountRefusedError);
        expect(error.pool).toBe("orchard");
        expect(error.actionIndex).toBe(0);
        expect(error.account).toBe(7);
        expect(error.errorCode).toBe("output_account_refused");
      }
    });

    it("reports a 6a80 on a declared Ironwood metadata packet as OutputAccountRefusedError", async () => {
      useDevice({
        refuse: {
          name: "PcztIronwoodAction",
          packet: METADATA_PACKET,
          code: "6a80",
        },
      });
      const result = await run(v6TransactionDeclaringAccounts(1, 2));

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        const error = result.error as OutputAccountRefusedError;
        expect(error).toBeInstanceOf(OutputAccountRefusedError);
        expect(error.pool).toBe("ironwood");
        expect(error.actionIndex).toBe(0);
        expect(error.account).toBe(2);
      }
    });

    it("passes a 6a80 on another packet of the declared action through", async () => {
      useDevice({
        refuse: {
          name: "PcztOrchardAction",
          packet: METADATA_PACKET - 1,
          code: "6a80",
        },
      });
      const result = await run(orchardTransactionDeclaringAccount(1));

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        expect(result.error).toBeInstanceOf(ZcashAppCommandError);
        expect((result.error as ZcashAppCommandError).errorCode).toBe("6a80");
      }
    });

    it("passes a 6a84 on the declared metadata packet through", async () => {
      useDevice({
        refuse: {
          name: "PcztOrchardAction",
          packet: METADATA_PACKET,
          code: "6a84",
        },
      });
      const result = await run(orchardTransactionDeclaringAccount(1));

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        expect(result.error).toBeInstanceOf(ZcashAppCommandError);
        expect((result.error as ZcashAppCommandError).errorCode).toBe("6a84");
      }
    });

    it("passes a 6a80 on the metadata packet of an undeclared action through", async () => {
      useDevice({
        refuse: {
          name: "PcztOrchardAction",
          packet: METADATA_PACKET,
          code: "6a80",
        },
      });
      const result = await run(privateToPrivateTransaction());

      expect(isSuccessDmkResult(result)).toBe(false);
      if (!isSuccessDmkResult(result)) {
        expect(result.error).toBeInstanceOf(ZcashAppCommandError);
      }
    });
  });
});
