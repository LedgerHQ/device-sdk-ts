import { descriptor } from "@internal/app-binder/clear-sign/requirements/__tests__/fixtures/calBuilders";
import {
  type MatchedInstruction,
  type RequirementAccount,
} from "@internal/app-binder/clear-sign/requirements/model";
import {
  type ParsedAccountReset,
  type ParsedInstruction,
  type ParsedResetWitness,
  ValueKind,
} from "@internal/app-binder/clear-sign/requirements/records";
import { RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

import { applyResetWitnessRule } from "./resetWitnessRule";

const JUPITER = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
const ROUTE_WITH_TOKEN_LEDGER = Uint8Array.of(
  0x96,
  0x56,
  0x47,
  0x74,
  0xa7,
  0x5d,
  0x0e,
  0x68,
);
const SHARED_ROUTE_WITH_TOKEN_LEDGER = Uint8Array.of(
  0xe6,
  0x79,
  0x8f,
  0x50,
  0x77,
  0x9f,
  0x6a,
  0xaa,
);

/** An ALT-backed slot at `entryIndex` of the "ALT" table. */
function alt(entryIndex: number, isWritable = false): RequirementAccount {
  return {
    altRef: { altAddress: "ALT", entryIndex },
    isWritable,
    isSigner: false,
  };
}

/** A statically resolved slot. */
function addr(address: string, isWritable = false): RequirementAccount {
  return { address, isWritable, isSigner: false };
}

/** `count` read-only static slots, so a consumer index lands where a test puts it. */
function filler(count: number): RequirementAccount[] {
  return Array.from({ length: count }, (_, i) => addr(`filler${i}`));
}

/**
 * Jupiter's `setTokenLedger` witness: the ledger is the declaring
 * instruction's slot 0, and `routeWithTokenLedger` (slot 7) and
 * `sharedAccountsRouteWithTokenLedger` (slot 11) consume it.
 */
const JUPITER_WITNESS: ParsedResetWitness = {
  programId: JUPITER,
  resetAccountIndex: 0,
  consumers: [
    { discriminator: ROUTE_WITH_TOKEN_LEDGER, accountIndex: 7 },
    { discriminator: SHARED_ROUTE_WITH_TOKEN_LEDGER, accountIndex: 11 },
  ],
};

function reset(witness?: ParsedResetWitness): ParsedAccountReset {
  return {
    accountIndex: 1,
    requirePreBalanceZero: false,
    valueKind: ValueKind.NATIVE,
    requireNativePreBalanceZero: false,
    witness,
  };
}

function step(
  accounts: RequirementAccount[],
  opts: {
    programId?: string;
    data?: Uint8Array;
    accountResets?: ParsedAccountReset[];
  } = {},
): { match: MatchedInstruction; records: ParsedInstruction } {
  return {
    match: {
      instruction: {
        programId: opts.programId ?? JUPITER,
        accounts,
        data: opts.data ?? new Uint8Array(),
      },
      descriptor: descriptor(),
    },
    records: {
      info: {
        typePool: [],
        rootType: 0,
        mintAssociations: [],
        ownerAssociations: [],
      },
      valueFlowPorts: [],
      accountResets: opts.accountResets ?? [],
      displayFields: [],
      hideRules: [],
    },
  };
}

/** `setTokenLedger` declaring the Jupiter witness over the given ledger slot. */
function setTokenLedger(
  ledger: RequirementAccount,
  witness: ParsedResetWitness = JUPITER_WITNESS,
) {
  return step([ledger, addr("tokenAccount")], {
    accountResets: [reset(witness)],
  });
}

/** A route reading `ledger` at slot 7. */
function routeWithTokenLedger(
  ledger: RequirementAccount,
  opts: { programId?: string; data?: Uint8Array } = {},
) {
  return step([...filler(7), ledger, ...filler(2)], {
    programId: opts.programId,
    data: opts.data ?? Uint8Array.of(...ROUTE_WITH_TOKEN_LEDGER, 0x01),
  });
}

function run(
  instructions: ReturnType<typeof step>[],
): ReturnType<RequirementAccumulator["build"]>["altResolutions"] {
  const accumulator = new RequirementAccumulator();
  applyResetWitnessRule(instructions, accumulator);
  return accumulator.build().altResolutions;
}

describe("applyResetWitnessRule", () => {
  it("resolves a read-only ALT ledger on the consumer side", () => {
    // The regression this rule fixes: the route only reads the ledger, so no
    // other rule streams it, and the device cannot compare the two ends.
    expect(
      run([setTokenLedger(addr("ledger", true)), routeWithTokenLedger(alt(9))]),
    ).toEqual([{ altAddress: "ALT", entryIndex: 9 }]);
  });

  it("resolves the ledger on the declaring side", () => {
    expect(
      run([setTokenLedger(alt(4, true)), routeWithTokenLedger(addr("ledger"))]),
    ).toEqual([{ altAddress: "ALT", entryIndex: 4 }]);
  });

  it("matches each consumer at its own account index", () => {
    const shared = step([...filler(11), alt(12), ...filler(3)], {
      data: SHARED_ROUTE_WITH_TOKEN_LEDGER,
    });
    expect(
      run([
        setTokenLedger(addr("ledger")),
        routeWithTokenLedger(alt(10)),
        shared,
      ]),
    ).toEqual([
      { altAddress: "ALT", entryIndex: 10 },
      { altAddress: "ALT", entryIndex: 12 },
    ]);
  });

  it("streams a candidate's slot without comparing addresses", () => {
    // The host cannot know an ALT-supplied address; the device decides whether
    // it is the ledger. A static mismatch on the declaring side changes nothing.
    expect(
      run([
        setTokenLedger(addr("ledgerA")),
        routeWithTokenLedger(alt(9)),
        routeWithTokenLedger(alt(13)),
      ]),
    ).toEqual([
      { altAddress: "ALT", entryIndex: 9 },
      { altAddress: "ALT", entryIndex: 13 },
    ]);
  });

  it("ignores an instruction whose data matches no consumer", () => {
    expect(
      run([
        setTokenLedger(addr("ledger")),
        routeWithTokenLedger(alt(9), { data: Uint8Array.of(0xe5, 0x17) }),
      ]),
    ).toEqual([]);
  });

  it("ignores data shorter than the consumer's discriminator", () => {
    expect(
      run([
        setTokenLedger(addr("ledger")),
        routeWithTokenLedger(alt(9), {
          data: ROUTE_WITH_TOKEN_LEDGER.slice(0, 4),
        }),
      ]),
    ).toEqual([]);
  });

  it("ignores another program, even with a matching discriminator", () => {
    expect(
      run([
        setTokenLedger(addr("ledger")),
        routeWithTokenLedger(alt(9), { programId: "OtherProgram" }),
      ]),
    ).toEqual([]);
  });

  it("ignores a consumer placed before the declaring instruction", () => {
    expect(
      run([routeWithTokenLedger(alt(9)), setTokenLedger(addr("ledger"))]),
    ).toEqual([]);
  });

  it("skips a consumer index out of range of the candidate, without failing", () => {
    // Every in-range slot is ALT-backed, so any wrong index would show up.
    const short = step([alt(20), alt(21), alt(22)], {
      data: ROUTE_WITH_TOKEN_LEDGER,
    });
    expect(run([setTokenLedger(addr("ledger")), short])).toEqual([]);
  });

  it("admits any data of the program for an empty discriminator", () => {
    const anyInstruction: ParsedResetWitness = {
      programId: JUPITER,
      resetAccountIndex: 0,
      consumers: [{ discriminator: new Uint8Array(), accountIndex: 7 }],
    };
    expect(
      run([
        setTokenLedger(addr("ledger"), anyInstruction),
        routeWithTokenLedger(alt(9), { data: Uint8Array.of(0x42) }),
      ]),
    ).toEqual([{ altAddress: "ALT", entryIndex: 9 }]);
  });

  it("does nothing for a reset without a witness", () => {
    expect(
      run([
        step([alt(4), addr("tokenAccount")], { accountResets: [reset()] }),
        routeWithTokenLedger(alt(9)),
      ]),
    ).toEqual([]);
  });

  it("requests an entry once when both ends come from the same ALT entry", () => {
    expect(
      run([setTokenLedger(alt(5, true)), routeWithTokenLedger(alt(5))]),
    ).toEqual([{ altAddress: "ALT", entryIndex: 5 }]);
  });
});
