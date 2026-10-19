import { InvalidArgumentError } from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import {
  type PcztIronwoodAction,
  type PcztOrchardAction,
  type PcztTransaction,
} from "@api/model/PcztTransaction";

/** First Zcash app version accepting the output account extension. */
export const MIN_APP_VERSION_FOR_OUTPUT_ACCOUNT = "3.9.5";

/** Highest ZIP 32 account index the device accepts in a declaration. */
const MAX_DECLARED_ACCOUNT = 100;

/** Most distinct accounts the device keeps per transaction (both pools). */
const MAX_DECLARED_ACCOUNTS = 4;

/** ZIP 32 purpose, hardened. */
const ZIP32_PURPOSE = 32;

const HARDENED = DerivationPathUtils.PADDING;

/** Seed fingerprint used when the PCZT omits one (32 zero bytes). */
const DEFAULT_SEED_FINGERPRINT = new Uint8Array(32);

export type ResolvedOutputAccounts = {
  /** Declared account per Orchard action, `undefined` when not declared. */
  orchard: (number | undefined)[];
  /** Declared account per Ironwood action, `undefined` when not declared. */
  ironwood: (number | undefined)[];
  /** Number of declarations across both pools. */
  count: number;
};

type Pool = "orchard" | "ironwood";
type ShieldedAction = PcztOrchardAction | PcztIronwoodAction;

const parsePath = (path: string): number[] | null => {
  try {
    return DerivationPathUtils.splitPath(path);
  } catch {
    return null;
  }
};

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Parses an app version `major.minor.patch` and compares it field by field with
 * `floor`. An unparseable version is never at least the floor.
 */
export const isAppVersionAtLeast = (
  version: string,
  floor: string,
): boolean => {
  const parse = (value: string): number[] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
    return match
      ? [Number(match[1]), Number(match[2]), Number(match[3])]
      : null;
  };
  const actual = parse(version);
  const minimum = parse(floor);
  if (actual === null || minimum === null) {
    return false;
  }
  for (let i = 0; i < 3; i += 1) {
    if (actual[i]! !== minimum[i]!) {
      return actual[i]! > minimum[i]!;
    }
  }
  return true;
};

/**
 * Validates every output account declaration of the transaction and reduces each
 * to its ZIP 32 account index. The rules mirror what the device refuses, so a
 * well-formed caller never meets those refusals mid-transaction.
 */
export const resolveOutputAccounts = (
  transaction: PcztTransaction,
): ResolvedOutputAccounts | InvalidArgumentError => {
  const pools: { pool: Pool; actions: ShieldedAction[] }[] = [
    { pool: "orchard", actions: transaction.orchardBundle?.actions ?? [] },
    { pool: "ironwood", actions: transaction.ironwoodBundle?.actions ?? [] },
  ];

  // The device pins the account of every action's signing path, dummy padding
  // spends included, and refuses a declaration naming that account.
  const spentAccounts = new Set<number>();
  for (const { actions } of pools) {
    for (const action of actions) {
      const spendPath = parsePath(action.signingPath);
      if (spendPath !== null && spendPath.length >= 3) {
        spentAccounts.add(spendPath[2]! % HARDENED);
      }
    }
  }

  const resolved: Record<Pool, (number | undefined)[]> = {
    orchard: [],
    ironwood: [],
  };
  const distinct = new Set<number>();
  let count = 0;

  for (const { pool, actions } of pools) {
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index]!;
      const derivation = action.outputZip32Derivation;
      if (!derivation) {
        resolved[pool].push(undefined);
        continue;
      }
      const where = `${pool} action ${index}`;
      const fail = (rule: string) =>
        new InvalidArgumentError(
          `Invalid output account declaration on ${where}: ${rule}`,
        );

      const declared = parsePath(derivation.path);
      if (declared === null || declared.length !== 3) {
        return fail("the path must have exactly 3 components");
      }
      if (declared.some((component) => component < HARDENED)) {
        return fail("every path component must be hardened");
      }
      if (declared[0]! - HARDENED !== ZIP32_PURPOSE) {
        return fail("the purpose must be 32'");
      }

      const spend = parsePath(action.signingPath);
      if (
        spend === null ||
        spend.length < 3 ||
        declared[0] !== spend[0] ||
        declared[1] !== spend[1]
      ) {
        return fail(
          "the purpose and coin type must match the spend signing path",
        );
      }
      if (
        !sameBytes(
          derivation.seedFingerprint ?? DEFAULT_SEED_FINGERPRINT,
          action.seedFingerprint ?? DEFAULT_SEED_FINGERPRINT,
        )
      ) {
        return fail("the seed fingerprint must match the spend");
      }

      const account = declared[2]! - HARDENED;
      if (account > MAX_DECLARED_ACCOUNT) {
        return fail(`the account must be at most ${MAX_DECLARED_ACCOUNT}`);
      }
      if (spentAccounts.has(account)) {
        return fail(`account ${account} is the account being spent`);
      }

      distinct.add(account);
      if (distinct.size > MAX_DECLARED_ACCOUNTS) {
        return fail(
          `at most ${MAX_DECLARED_ACCOUNTS} distinct accounts can be declared per transaction`,
        );
      }
      resolved[pool].push(account);
      count += 1;
    }
  }

  return { orchard: resolved.orchard, ironwood: resolved.ironwood, count };
};
