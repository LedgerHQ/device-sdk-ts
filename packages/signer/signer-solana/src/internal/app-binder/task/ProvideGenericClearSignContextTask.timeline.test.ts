/**
 * Characterisation ("timeline") tests for ProvideGenericClearSignContextTask.
 *
 * These tests record, in one ordered list, everything the task does on the
 * outside: every APDU sent to the device (command `name` + raw bytes), every
 * backend fetch (requested types + input) and every warn / error log (with its
 * logger tag and data). The list is pinned as an inline snapshot, so any
 * change to the generic clear-sign stream (a byte, the order, a fetch, a log
 * text, tag or data) fails here.
 *
 * Frozen: refactors must leave this file untouched. Only behaviour-changing
 * bug-fix tickets may update it, deliberately.
 *
 * Rules: record the command `name` (not class names) and raw bytes (not
 * instances), and write literals instead of importing production constants.
 */
import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  CommandResultFactory,
  DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

import { type ChallengeBoundRequirements } from "./BuildGenericClearSignContextTask";
import { ProvideGenericClearSignContextTask } from "./ProvideGenericClearSignContextTask";

const NO_CHALLENGE_BOUND: ChallengeBoundRequirements = {
  tokenAccountStates: [],
  altResolutions: [],
  trustedNames: [],
  tokenAmountAltRefs: [],
  tokenAccountStateAltRefs: [],
  mintAltRefs: [],
  trustedNameAltRefs: [],
};

const CERT = { payload: new Uint8Array([0xce, 0x01]), keyUsageNumber: 11 };

/** ASCII bytes of `name`: unique per descriptor, and traceable in the hex. */
const bytesOf = (name: string): Uint8Array => new TextEncoder().encode(name);
const hexOf = (name: string): string =>
  bufferToHexaString(bytesOf(name), false);

// --- Context fixtures -------------------------------------------------------

/** TOKEN_INFO (0x22) only accepts a 70 to 72-byte DER signature. */
const TOKEN_INFO_SIGNATURE = "51".repeat(70);

function tokenInfoCtx(mint: string): ClearSignContext {
  return {
    type: ClearSignContextType.SOLANA_TOKEN_INFO,
    payload: {
      mint,
      descriptor: { data: hexOf(mint), signature: TOKEN_INFO_SIGNATURE },
    },
    certificate: CERT,
  } as unknown as ClearSignContext;
}

function enumVariantCtx(data = "e0e1"): ClearSignContext {
  return {
    type: ClearSignContextType.SOLANA_ENUM_VARIANT,
    payload: {
      programId: "PROG",
      enumId: "E",
      variantIndex: 2,
      descriptor: { data, signature: "5252" },
    },
    certificate: CERT,
  } as unknown as ClearSignContext;
}

function tokenAccountStateCtx(
  tokenAccount: string,
  mint: string,
): ClearSignContext {
  return {
    type: ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
    payload: { mint, descriptor: bytesOf(`state:${tokenAccount}`) },
    certificate: CERT,
  } as unknown as ClearSignContext;
}

function altResolutionCtx(ref: string, resolvedAddress: string) {
  return {
    type: ClearSignContextType.SOLANA_ALT_RESOLUTION,
    payload: { resolvedAddress, descriptor: bytesOf(`alt:${ref}`) },
    certificate: CERT,
  } as unknown as ClearSignContext;
}

function trustedNameCtx(address: string): ClearSignContext {
  return {
    type: ClearSignContextType.SOLANA_TRUSTED_NAME,
    payload: bytesOf(`name:${address}`),
    certificate: CERT,
  } as unknown as ClearSignContext;
}

/**
 * A template whose INSTRUCTION_INFO is 520 data bytes + a 4-byte SIGNATURE
 * TLV = 524 bytes, so it is streamed in 3 chunks (255 + 255 + 14) and the
 * snapshot shows the P2 sequence 0x02 -> 0x03 -> 0x01.
 */
function longInstructionInfoCtx(): ClearSignContext {
  return {
    type: ClearSignContextType.SOLANA_INSTRUCTION_INFO,
    payload: {
      programId: "PROG",
      discriminator: "0102",
      instructionInfo: { data: "11".repeat(520), signature: "5353" },
      substructures: [{ kind: 0x01, data: "abcd" }],
      enumVariants: [],
    },
    certificate: CERT,
  } as unknown as ClearSignContext;
}

// --- Backend routing --------------------------------------------------------

type Backend = {
  /** token account -> mint carried by its TOKEN_ACCOUNT_STATE */
  states?: Record<string, string>;
  /** `${altAddress}:${entryIndex}` -> resolved address */
  alts?: Record<string, string>;
  /** mints that have a TOKEN_INFO */
  mints?: string[];
  /** addresses that have a TRUSTED_NAME */
  names?: string[];
};

/** The union of the fields the task puts in its `getContexts` inputs. */
type FetchInput = {
  mints?: string[];
  requests?: {
    tokenAccount?: string;
    altAddress?: string;
    entryIndex?: number;
    address?: string;
  }[];
};

function route(
  backend: Backend,
  input: FetchInput,
  types: ClearSignContextType[],
): ClearSignContext[] {
  const request = input.requests?.[0] ?? {};
  switch (types[0]) {
    case ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE: {
      const tokenAccount = request.tokenAccount ?? "";
      const mint = backend.states?.[tokenAccount];
      return mint ? [tokenAccountStateCtx(tokenAccount, mint)] : [];
    }
    case ClearSignContextType.SOLANA_ALT_RESOLUTION: {
      const ref = `${request.altAddress}:${request.entryIndex}`;
      const resolved = backend.alts?.[ref];
      return resolved ? [altResolutionCtx(ref, resolved)] : [];
    }
    case ClearSignContextType.SOLANA_TOKEN_INFO: {
      const mint = input.mints?.[0] ?? "";
      return backend.mints?.includes(mint) ? [tokenInfoCtx(mint)] : [];
    }
    case ClearSignContextType.SOLANA_TRUSTED_NAME: {
      const address = request.address ?? "";
      return backend.names?.includes(address) ? [trustedNameCtx(address)] : [];
    }
    default:
      return [];
  }
}

/**
 * A backend that answers with `override` when it returns contexts, and with
 * {@link route} otherwise. Used to return several descriptors from one fetch.
 */
function backendWith(
  backend: Backend,
  override: (
    input: FetchInput,
    types: ClearSignContextType[],
  ) => ClearSignContext[] | undefined,
) {
  return (input: FetchInput, types: ClearSignContextType[]) =>
    Promise.resolve(override(input, types) ?? route(backend, input, types));
}

// --- Harness ----------------------------------------------------------------

type RecordedCommand = {
  name: string;
  getApdu: () => { getRawApdu: () => Uint8Array };
};

function makeTimelineTask(opts: {
  poolContexts?: ClearSignContext[];
  instructionInfoContexts?: ClearSignContext[];
  requirements?: Partial<ChallengeBoundRequirements>;
  backend?: Backend;
  /** Overrides the backend: return a rejected promise to simulate a failure. */
  getContexts?: (
    input: FetchInput,
    types: ClearSignContextType[],
  ) => Promise<ClearSignContext[]>;
  /** Called for every APDU after it is recorded: an Error rejects that send. */
  failOn?: (cmd: RecordedCommand) => Error | undefined;
  /** The device answers these APDUs with an error status. */
  deviceRejects?: (cmd: RecordedCommand) => boolean;
}) {
  const timeline: string[] = [];

  const loggerFactory = (tag: string) => ({
    subscribers: [],
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn((message: string, options?: { data?: unknown }) => {
      timeline.push(`warn[${tag}] ${message} ${JSON.stringify(options?.data)}`);
    }),
    error: vi.fn((message: string, options?: { data?: unknown }) => {
      const data =
        options?.data === undefined ? "" : ` ${JSON.stringify(options.data)}`;
      timeline.push(`error[${tag}] ${message}${data}`);
    }),
  });

  // Each GET CHALLENGE answers a different challenge, so the snapshot shows
  // that every fetch carries the challenge issued right before it.
  let challengeCount = 0;
  const api = {
    sendCommand: vi.fn((cmd: RecordedCommand) => {
      const raw = bufferToHexaString(cmd.getApdu().getRawApdu(), false);
      // 5-byte header (CLA INS P1 P2 Lc), then the data (if any).
      const data = raw.slice(10);
      timeline.push(
        `apdu ${cmd.name} ${raw.slice(0, 10)}${data ? ` ${data}` : ""}`,
      );
      const failure = opts.failOn?.(cmd);
      if (failure) return Promise.reject(failure);
      if (opts.deviceRejects?.(cmd)) {
        return Promise.resolve(
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("rejected"),
          }),
        );
      }
      if (cmd instanceof GetChallengeCommand) {
        challengeCount += 1;
        return Promise.resolve(
          CommandResultFactory({ data: { challenge: `c${challengeCount}` } }),
        );
      }
      return Promise.resolve(CommandResultFactory({ data: undefined }));
    }),
    getDeviceSessionState: vi.fn(() => ({ deviceModelId: DeviceModelId.STAX })),
  };

  const getContexts = vi.fn(
    async (input: FetchInput, types: ClearSignContextType[]) => {
      timeline.push(`fetch ${types.join(",")} ${JSON.stringify(input)}`);
      return opts.getContexts
        ? await opts.getContexts(input, types)
        : route(opts.backend ?? {}, input, types);
    },
  );

  const task = new ProvideGenericClearSignContextTask(
    api as unknown as InternalApi,
    {
      derivationPath: "44'/501'/0'",
      transaction: new Uint8Array([0x01, 0x02, 0x03]),
      poolContexts: opts.poolContexts ?? [],
      instructionInfoContexts: opts.instructionInfoContexts ?? [],
      challengeBoundRequirements: {
        ...NO_CHALLENGE_BOUND,
        ...opts.requirements,
      },
      contextModule: { getContexts } as unknown as ContextModule,
      loggerFactory,
    },
  );

  return { task, timeline };
}

// --- Tests ------------------------------------------------------------------

describe("ProvideGenericClearSignContextTask timeline", () => {
  it("CT-1: streams preview, pool, every challenge-bound bucket in order, then templates", async () => {
    const { task, timeline } = makeTimelineTask({
      poolContexts: [tokenInfoCtx("POOL_MINT"), enumVariantCtx()],
      instructionInfoContexts: [longInstructionInfoCtx()],
      requirements: {
        // Listed twice: streamed once. TA_MISSING has no descriptor.
        tokenAccountStates: ["TA1", "TA_MISSING", "TA1"],
        // Plain ALT ref that is also a trusted-name target.
        altResolutions: [{ altAddress: "ALT_PLAIN", entryIndex: 0 }],
        trustedNameAltRefs: [{ altAddress: "ALT_PLAIN", entryIndex: 0 }],
        mintAltRefs: [
          { altAddress: "ALT_MINT", entryIndex: 1 },
          // Resolves to the pool's mint: its TOKEN_INFO is not fetched again.
          { altAddress: "ALT_MINT", entryIndex: 6 },
        ],
        tokenAmountAltRefs: [
          // Resolves to a mint: the optimistic TOKEN_INFO hits.
          { altAddress: "ALT_AMT", entryIndex: 2 },
          // Resolves to a token account: the optimistic TOKEN_INFO misses
          // (silently), then TOKEN_ACCOUNT_STATE + TOKEN_INFO.
          { altAddress: "ALT_AMT", entryIndex: 3 },
        ],
        tokenAccountStateAltRefs: [
          // State found; its mint was already streamed by TA1.
          { altAddress: "ALT_TAS", entryIndex: 4 },
          // No state: falls back to TOKEN_INFO for the address itself.
          { altAddress: "ALT_TAS", entryIndex: 5 },
        ],
        trustedNames: ["NAMED_STATIC"],
      },
      backend: {
        states: {
          TA1: "MINT_TA",
          ATA_AMT: "MINT_ATA_AMT",
          TA_ALT: "MINT_TA",
        },
        alts: {
          "ALT_PLAIN:0": "NAMED_PLAIN",
          "ALT_MINT:1": "MINT_ALT",
          "ALT_MINT:6": "POOL_MINT",
          "ALT_AMT:2": "MINT_AMT",
          "ALT_AMT:3": "ATA_AMT",
          "ALT_TAS:4": "TA_ALT",
          "ALT_TAS:5": "MINT_TAS_FB",
        },
        mints: [
          "MINT_TA",
          "MINT_ALT",
          "MINT_AMT",
          "MINT_ATA_AMT",
          "MINT_TAS_FB",
        ],
        names: ["NAMED_STATIC", "NAMED_PLAIN"],
      },
    });

    const result = await task.run();

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(timeline).toMatchInlineSnapshot(`
      [
        "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu ProvideTLVTransactionInstructionDescriptor e022000051 504f4f4c5f4d494e54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideEnumVariant e026000006 e0e115025252",
        "apdu getChallenge e020000000",
        "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"TA1","challenge":"c1"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTokenAccountState e027000009 73746174653a544131",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_TA"],"network":"solana-mainnet"}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu ProvideTLVTransactionInstructionDescriptor e02200004f 4d494e545f5441084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        "apdu getChallenge e020000000",
        "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"TA_MISSING","challenge":"c2"}]}",
        "warn[ProvideGenericClearSignContextTask] [run] TOKEN_ACCOUNT_STATE fetch returned no descriptor; instruction may be pinned {"tokenAccount":"TA_MISSING"}",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_PLAIN","entryIndex":0,"challenge":"c3"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000f 616c743a414c545f504c41494e3a30",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_MINT","entryIndex":1,"challenge":"c4"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000e 616c743a414c545f4d494e543a31",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_ALT"],"network":"solana-mainnet"}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu ProvideTLVTransactionInstructionDescriptor e022000050 4d494e545f414c54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_MINT","entryIndex":6,"challenge":"c5"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000e 616c743a414c545f4d494e543a36",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":2,"challenge":"c6"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000d 616c743a414c545f414d543a32",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_AMT"],"network":"solana-mainnet"}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu ProvideTLVTransactionInstructionDescriptor e022000050 4d494e545f414d54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":3,"challenge":"c7"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000d 616c743a414c545f414d543a33",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["ATA_AMT"],"network":"solana-mainnet"}",
        "apdu getChallenge e020000000",
        "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"ATA_AMT","challenge":"c8"}]}",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_ATA_AMT"],"network":"solana-mainnet"}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTokenAccountState e02700000d 73746174653a4154415f414d54",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu ProvideTLVTransactionInstructionDescriptor e022000054 4d494e545f4154415f414d54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_TAS","entryIndex":4,"challenge":"c9"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000d 616c743a414c545f5441533a34",
        "apdu getChallenge e020000000",
        "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"TA_ALT","challenge":"c10"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTokenAccountState e02700000c 73746174653a54415f414c54",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_TAS","entryIndex":5,"challenge":"c11"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000d 616c743a414c545f5441533a35",
        "apdu getChallenge e020000000",
        "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"MINT_TAS_FB","challenge":"c12"}]}",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_TAS_FB"],"network":"solana-mainnet"}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu ProvideTLVTransactionInstructionDescriptor e022000053 4d494e545f5441535f4642084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        "apdu getChallenge e020000000",
        "fetch solanaTrustedName {"deviceModelId":"stax","network":"solana-mainnet","requests":[{"address":"NAMED_STATIC","challenge":"c13","types":["token","smart_contract"],"sources":["crypto_asset_list"]}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTrustedName e029000011 6e616d653a4e414d45445f535441544943",
        "apdu getChallenge e020000000",
        "fetch solanaTrustedName {"deviceModelId":"stax","network":"solana-mainnet","requests":[{"address":"NAMED_PLAIN","challenge":"c14","types":["token","smart_contract"],"sources":["crypto_asset_list"]}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTrustedName e029000010 6e616d653a4e414d45445f504c41494e",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideInstructionInfo e0240002ff 111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
        "apdu provideInstructionInfo e0240003ff 111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
        "apdu provideInstructionInfo e02400010e 1111111111111111111115025353",
        "apdu provideInstructionSubstructure e025000003 01abcd",
      ]
    `);
  });

  describe("CT-1b: an exception in the challenge-bound part rejects run()", () => {
    it("(a) the backend rejects inside a challenge-bound bucket: run() rejects and no template is streamed", async () => {
      const { task, timeline } = makeTimelineTask({
        instructionInfoContexts: [longInstructionInfoCtx()],
        requirements: {
          tokenAccountStates: ["TA1"],
          altResolutions: [{ altAddress: "ALT_PLAIN", entryIndex: 0 }],
        },
        getContexts: (input, types) =>
          types[0] === ClearSignContextType.SOLANA_ALT_RESOLUTION
            ? Promise.reject(new Error("backend down"))
            : Promise.resolve(
                route({ states: { TA1: "MINT_TA" } }, input, types),
              ),
      });

      await expect(task.run()).rejects.toThrow("backend down");
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"TA1","challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideTokenAccountState e027000009 73746174653a544131",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_TA"],"network":"solana-mainnet"}",
          "warn[ProvideGenericClearSignContextTask] [run] TOKEN_INFO fetch returned no descriptor; instruction may be pinned {"mint":"MINT_TA"}",
          "apdu getChallenge e020000000",
          "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_PLAIN","entryIndex":0,"challenge":"c2"}]}",
        ]
      `);
    });

    it("(b) GET CHALLENGE rejects: run() rejects and no template is streamed", async () => {
      const { task, timeline } = makeTimelineTask({
        instructionInfoContexts: [longInstructionInfoCtx()],
        requirements: { tokenAccountStates: ["TA1"] },
        backend: { states: { TA1: "MINT_TA" } },
        failOn: (cmd) =>
          cmd instanceof GetChallengeCommand
            ? new Error("transport lost")
            : undefined,
      });

      await expect(task.run()).rejects.toThrow("transport lost");
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
        ]
      `);
    });
  });
});

describe("ProvideGenericClearSignContextTask timeline: edge cases", () => {
  describe("CT-1c: first match versus all matches", () => {
    it("(a) two ALT_RESOLUTION from one fetch: both are streamed, the first one's address is used", async () => {
      const { task, timeline } = makeTimelineTask({
        requirements: {
          mintAltRefs: [{ altAddress: "ALT_MINT", entryIndex: 1 }],
        },
        getContexts: backendWith({ mints: ["MINT_A", "MINT_B"] }, (_, types) =>
          types[0] === ClearSignContextType.SOLANA_ALT_RESOLUTION
            ? [
                altResolutionCtx("ALT_MINT:1#a", "MINT_A"),
                altResolutionCtx("ALT_MINT:1#b", "MINT_B"),
              ]
            : undefined,
        ),
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_MINT","entryIndex":1,"challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideAltResolution e028000010 616c743a414c545f4d494e543a312361",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideAltResolution e028000010 616c743a414c545f4d494e543a312362",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_A"],"network":"solana-mainnet"}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e02200004e 4d494e545f41084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        ]
      `);
    });

    it("(b) two TOKEN_INFO through the normal path: both are streamed", async () => {
      const { task, timeline } = makeTimelineTask({
        requirements: { tokenAccountStates: ["TA1"] },
        getContexts: backendWith({ states: { TA1: "MINT_TA" } }, (_, types) =>
          types[0] === ClearSignContextType.SOLANA_TOKEN_INFO
            ? [tokenInfoCtx("MINT_TA"), tokenInfoCtx("MINT_TA_2")]
            : undefined,
        ),
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"TA1","challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideTokenAccountState e027000009 73746174653a544131",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_TA"],"network":"solana-mainnet"}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e02200004f 4d494e545f5441084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e022000051 4d494e545f54415f32084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        ]
      `);
    });

    it("(c) two TOKEN_INFO through the tokenAmount first-guess path: only the first is streamed", async () => {
      const { task, timeline } = makeTimelineTask({
        requirements: {
          tokenAmountAltRefs: [{ altAddress: "ALT_AMT", entryIndex: 2 }],
        },
        getContexts: backendWith(
          { alts: { "ALT_AMT:2": "MINT_AMT" } },
          (_, types) =>
            types[0] === ClearSignContextType.SOLANA_TOKEN_INFO
              ? [tokenInfoCtx("MINT_AMT"), tokenInfoCtx("MINT_AMT_2")]
              : undefined,
        ),
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":2,"challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideAltResolution e02800000d 616c743a414c545f414d543a32",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_AMT"],"network":"solana-mainnet"}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e022000050 4d494e545f414d54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        ]
      `);
    });

    it("(d) two TOKEN_INFO for the mint of a tokenAmount token account: only the first is streamed", async () => {
      const { task, timeline } = makeTimelineTask({
        requirements: {
          tokenAmountAltRefs: [{ altAddress: "ALT_AMT", entryIndex: 3 }],
        },
        getContexts: backendWith(
          {
            alts: { "ALT_AMT:3": "ATA_AMT" },
            states: { ATA_AMT: "MINT_ATA_AMT" },
          },
          (input, types) =>
            types[0] === ClearSignContextType.SOLANA_TOKEN_INFO &&
            input.mints?.[0] === "MINT_ATA_AMT"
              ? [tokenInfoCtx("MINT_ATA_AMT"), tokenInfoCtx("MINT_ATA_AMT_2")]
              : undefined,
        ),
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":3,"challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideAltResolution e02800000d 616c743a414c545f414d543a33",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["ATA_AMT"],"network":"solana-mainnet"}",
          "apdu getChallenge e020000000",
          "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"ATA_AMT","challenge":"c2"}]}",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_ATA_AMT"],"network":"solana-mainnet"}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideTokenAccountState e02700000d 73746174653a4154415f414d54",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e022000054 4d494e545f4154415f414d54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        ]
      `);
    });

    it("(e) two TOKEN_ACCOUNT_STATE for the plain token-account loop: both are streamed", async () => {
      const { task, timeline } = makeTimelineTask({
        requirements: { tokenAccountStates: ["TA1"] },
        getContexts: backendWith({ mints: ["MINT_1", "MINT_2"] }, (_, types) =>
          types[0] === ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE
            ? [
                tokenAccountStateCtx("TA1#a", "MINT_1"),
                tokenAccountStateCtx("TA1#b", "MINT_2"),
              ]
            : undefined,
        ),
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"TA1","challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideTokenAccountState e02700000b 73746174653a5441312361",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideTokenAccountState e02700000b 73746174653a5441312362",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_1"],"network":"solana-mainnet"}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e02200004e 4d494e545f31084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_2"],"network":"solana-mainnet"}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e02200004e 4d494e545f32084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        ]
      `);
    });

    it("(f) two TOKEN_ACCOUNT_STATE for a tokenAccountState ALT ref: only the first is streamed", async () => {
      const { task, timeline } = makeTimelineTask({
        requirements: {
          tokenAccountStateAltRefs: [{ altAddress: "ALT_TAS", entryIndex: 4 }],
        },
        getContexts: backendWith(
          { alts: { "ALT_TAS:4": "TA_ALT" }, mints: ["MINT_1", "MINT_2"] },
          (_, types) =>
            types[0] === ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE
              ? [
                  tokenAccountStateCtx("TA_ALT#a", "MINT_1"),
                  tokenAccountStateCtx("TA_ALT#b", "MINT_2"),
                ]
              : undefined,
        ),
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_TAS","entryIndex":4,"challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideAltResolution e02800000d 616c743a414c545f5441533a34",
          "apdu getChallenge e020000000",
          "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"TA_ALT","challenge":"c2"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideTokenAccountState e02700000e 73746174653a54415f414c542361",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_1"],"network":"solana-mainnet"}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e02200004e 4d494e545f31084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        ]
      `);
    });
  });

  it("CT-1d: an address the tokenAmount loop could not resolve is tried again by the tokenAccountState loop", async () => {
    // X misses both the TOKEN_INFO and the TOKEN_ACCOUNT_STATE lookups in the
    // tokenAmount loop, which marks nothing. The tokenAccountState loop then
    // fetches X's state again (with a fresh challenge), then X's TOKEN_INFO.
    const { task, timeline } = makeTimelineTask({
      requirements: {
        tokenAmountAltRefs: [{ altAddress: "ALT_AMT", entryIndex: 3 }],
        tokenAccountStateAltRefs: [{ altAddress: "ALT_TAS", entryIndex: 4 }],
      },
      backend: { alts: { "ALT_AMT:3": "X", "ALT_TAS:4": "X" } },
    });

    await task.run();
    expect(timeline).toMatchInlineSnapshot(`
      [
        "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":3,"challenge":"c1"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000d 616c743a414c545f414d543a33",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["X"],"network":"solana-mainnet"}",
        "apdu getChallenge e020000000",
        "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"X","challenge":"c2"}]}",
        "warn[ProvideGenericClearSignContextTask] [run] TOKEN_ACCOUNT_STATE fetch failed for a resolved TOKEN_AMOUNT.TOKEN ATA; instruction may be pinned {"tokenAccount":"X"}",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_TAS","entryIndex":4,"challenge":"c3"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000d 616c743a414c545f5441533a34",
        "apdu getChallenge e020000000",
        "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"X","challenge":"c4"}]}",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["X"],"network":"solana-mainnet"}",
        "warn[ProvideGenericClearSignContextTask] [run] TOKEN_INFO fetch returned no descriptor; instruction may be pinned {"mint":"X"}",
      ]
    `);
  });

  describe("CT-2: tokenAmount token-account fallback", () => {
    it("(a) no TOKEN_INFO for the attested mint: the state is not streamed", async () => {
      // Neighbour of BUG-1, covered by the same firmware question (D-4).
      const { task, timeline } = makeTimelineTask({
        requirements: {
          tokenAmountAltRefs: [{ altAddress: "ALT_AMT", entryIndex: 3 }],
        },
        backend: {
          alts: { "ALT_AMT:3": "ATA_AMT" },
          states: { ATA_AMT: "MINT_ATA_AMT" },
        },
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":3,"challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideAltResolution e02800000d 616c743a414c545f414d543a33",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["ATA_AMT"],"network":"solana-mainnet"}",
          "apdu getChallenge e020000000",
          "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"ATA_AMT","challenge":"c2"}]}",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_ATA_AMT"],"network":"solana-mainnet"}",
          "warn[ProvideGenericClearSignContextTask] [run] TOKEN_INFO fetch failed for a resolved TOKEN_AMOUNT.TOKEN mint; instruction may be pinned {"mint":"MINT_ATA_AMT"}",
        ]
      `);
    });

    it("(b) the token account was already streamed: it is skipped", async () => {
      const { task, timeline } = makeTimelineTask({
        requirements: {
          tokenAccountStates: ["ATA_AMT"],
          tokenAmountAltRefs: [{ altAddress: "ALT_AMT", entryIndex: 3 }],
        },
        backend: {
          alts: { "ALT_AMT:3": "ATA_AMT" },
          states: { ATA_AMT: "MINT_ATA_AMT" },
          mints: ["MINT_ATA_AMT"],
        },
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu getChallenge e020000000",
          "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"ATA_AMT","challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideTokenAccountState e02700000d 73746174653a4154415f414d54",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_ATA_AMT"],"network":"solana-mainnet"}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e022000054 4d494e545f4154415f414d54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
          "apdu getChallenge e020000000",
          "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":3,"challenge":"c2"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideAltResolution e02800000d 616c743a414c545f414d543a33",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["ATA_AMT"],"network":"solana-mainnet"}",
        ]
      `);
    });

    it("(c) the attested mint was already streamed: the state is fetched but dropped", async () => {
      // BUG-1: deliberately changes this
      const { task, timeline } = makeTimelineTask({
        poolContexts: [tokenInfoCtx("POOL_MINT")],
        requirements: {
          tokenAmountAltRefs: [{ altAddress: "ALT_AMT", entryIndex: 3 }],
        },
        backend: {
          alts: { "ALT_AMT:3": "ATA_AMT" },
          states: { ATA_AMT: "POOL_MINT" },
        },
      });

      await task.run();
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu ProvideTLVTransactionInstructionDescriptor e022000051 504f4f4c5f4d494e54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
          "apdu getChallenge e020000000",
          "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":3,"challenge":"c1"}]}",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideAltResolution e02800000d 616c743a414c545f414d543a33",
          "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["ATA_AMT"],"network":"solana-mainnet"}",
          "apdu getChallenge e020000000",
          "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"ATA_AMT","challenge":"c2"}]}",
        ]
      `);
    });
  });

  it("CT-3: trusted names are also collected through the mint, tokenAmount and tokenAccountState ALT loops", async () => {
    const { task, timeline } = makeTimelineTask({
      requirements: {
        mintAltRefs: [{ altAddress: "ALT_MINT", entryIndex: 1 }],
        tokenAmountAltRefs: [{ altAddress: "ALT_AMT", entryIndex: 2 }],
        tokenAccountStateAltRefs: [{ altAddress: "ALT_TAS", entryIndex: 4 }],
        trustedNameAltRefs: [
          { altAddress: "ALT_MINT", entryIndex: 1 },
          { altAddress: "ALT_AMT", entryIndex: 2 },
          { altAddress: "ALT_TAS", entryIndex: 4 },
        ],
      },
      backend: {
        alts: {
          "ALT_MINT:1": "MINT_ALT",
          "ALT_AMT:2": "MINT_AMT",
          "ALT_TAS:4": "TA_ALT",
        },
        states: { TA_ALT: "MINT_ALT" },
        mints: ["MINT_ALT", "MINT_AMT"],
        names: ["MINT_ALT", "MINT_AMT", "TA_ALT"],
      },
    });

    await task.run();
    expect(timeline).toMatchInlineSnapshot(`
      [
        "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_MINT","entryIndex":1,"challenge":"c1"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000e 616c743a414c545f4d494e543a31",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_ALT"],"network":"solana-mainnet"}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu ProvideTLVTransactionInstructionDescriptor e022000050 4d494e545f414c54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_AMT","entryIndex":2,"challenge":"c2"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000d 616c743a414c545f414d543a32",
        "fetch solanaTokenInfo {"deviceModelId":"stax","mints":["MINT_AMT"],"network":"solana-mainnet"}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu ProvideTLVTransactionInstructionDescriptor e022000050 4d494e545f414d54084651515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151515151",
        "apdu getChallenge e020000000",
        "fetch solanaAltResolution {"deviceModelId":"stax","requests":[{"altAddress":"ALT_TAS","entryIndex":4,"challenge":"c3"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideAltResolution e02800000d 616c743a414c545f5441533a34",
        "apdu getChallenge e020000000",
        "fetch solanaTokenAccountState {"deviceModelId":"stax","requests":[{"tokenAccount":"TA_ALT","challenge":"c4"}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTokenAccountState e02700000c 73746174653a54415f414c54",
        "apdu getChallenge e020000000",
        "fetch solanaTrustedName {"deviceModelId":"stax","network":"solana-mainnet","requests":[{"address":"MINT_ALT","challenge":"c5","types":["token","smart_contract"],"sources":["crypto_asset_list"]}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTrustedName e02900000d 6e616d653a4d494e545f414c54",
        "apdu getChallenge e020000000",
        "fetch solanaTrustedName {"deviceModelId":"stax","network":"solana-mainnet","requests":[{"address":"MINT_AMT","challenge":"c6","types":["token","smart_contract"],"sources":["crypto_asset_list"]}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTrustedName e02900000d 6e616d653a4d494e545f414d54",
        "apdu getChallenge e020000000",
        "fetch solanaTrustedName {"deviceModelId":"stax","network":"solana-mainnet","requests":[{"address":"TA_ALT","challenge":"c7","types":["token","smart_contract"],"sources":["crypto_asset_list"]}]}",
        "apdu loadCertificate b0060b0002 ce01",
        "apdu provideTrustedName e02900000b 6e616d653a54415f414c54",
      ]
    `);
  });

  describe("CT-4: a failing ENUM_VARIANT in the pool is fatal", () => {
    it("(a) the device rejects it: run() returns a failure and streams nothing else", async () => {
      const { task, timeline } = makeTimelineTask({
        poolContexts: [enumVariantCtx(), tokenInfoCtx("POOL_MINT")],
        instructionInfoContexts: [longInstructionInfoCtx()],
        requirements: { tokenAccountStates: ["TA1"] },
        backend: { states: { TA1: "MINT_TA" } },
        deviceRejects: (cmd) => cmd.name === "provideEnumVariant",
      });

      const result = await task.run();

      expect(isSuccessCommandResult(result)).toBe(false);
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu loadCertificate b0060b0002 ce01",
          "apdu provideEnumVariant e026000006 e0e115025252",
        ]
      `);
    });

    it("(b) its descriptor is malformed: run() logs an error, returns a failure and streams nothing else", async () => {
      const { task, timeline } = makeTimelineTask({
        poolContexts: [enumVariantCtx("zz"), tokenInfoCtx("POOL_MINT")],
        instructionInfoContexts: [longInstructionInfoCtx()],
        requirements: { tokenAccountStates: ["TA1"] },
        backend: { states: { TA1: "MINT_TA" } },
      });

      const result = await task.run();

      expect(isSuccessCommandResult(result)).toBe(false);
      expect(timeline).toMatchInlineSnapshot(`
        [
          "apdu signMessageGenericPreview e00a010011 01038000002c800001f580000000010203",
          "apdu loadCertificate b0060b0002 ce01",
          "error[ProvideGenericClearSignContextTask] [provideEnumVariantContext] malformed ENUM_VARIANT for PROG:E:2",
        ]
      `);
    });
  });
});
