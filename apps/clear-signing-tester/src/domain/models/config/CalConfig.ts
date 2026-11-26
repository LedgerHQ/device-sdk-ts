/**
 * CAL branches a run can read. `main` is production; `next` is where CAL
 * changes land before the quorum signs and releases them.
 */
export const CAL_BRANCHES = ["main", "next", "demo"] as const;

export type CalBranch = (typeof CAL_BRANCHES)[number];

/**
 * Which of CAL's signatures the device verifies: `prod` against the production
 * PKI root, `test` against the staging key, through the certificates the CAL
 * interceptor serves.
 */
export const CAL_MODES = ["prod", "test"] as const;

export type CalMode = (typeof CAL_MODES)[number];

/** CAL's production endpoint. It serves every branch; `ref` picks one. */
export const CAL_URL = "https://global.api.prd.ledger.com/cal/v1";

/**
 * Configuration for CAL (Crypto Assets List) service
 */
export type CalConfig = {
  url: string;
  mode: CalMode;
  branch: CalBranch;
};
