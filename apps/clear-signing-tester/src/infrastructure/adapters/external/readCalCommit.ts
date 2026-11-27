import { type Either, Left, Right } from "purify-ts";

import {
  CAL_URL,
  type CalBranch,
} from "@root/src/domain/models/config/CalConfig";

/** Response header naming the crypto-assets commit CAL served. */
export const CAL_COMMIT_HEADER = "X-Ledger-Commit";

/** The request only labels the run, so a stuck one must not hold it up. */
const TIMEOUT_MS = 15_000;

/**
 * The crypto-assets commit CAL serves for a branch, from the header of the
 * cheapest request that carries a `ref`.
 *
 * `next` moves several times a day and is force-reset after each signature
 * merge, so a run's results only mean something next to the commit it read.
 * Read once at startup: CAL refreshes a branch in the background, so a long
 * run may end on a later commit than the one it names.
 */
export async function readCalCommit(
  branch: CalBranch,
  fetchFn: typeof fetch = fetch,
): Promise<Either<Error, string>> {
  const url = `${CAL_URL}/tokens?limit=1&output=id&ref=branch:${branch}`;
  try {
    const response = await fetchFn(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Only the headers matter. An unread body would hold the connection open.
    await response.body?.cancel();
    if (!response.ok) {
      return Left(new Error(`GET ${url} failed with ${response.status}`));
    }
    const commit = response.headers.get(CAL_COMMIT_HEADER);
    return commit
      ? Right(commit)
      : Left(new Error(`GET ${url} returned no ${CAL_COMMIT_HEADER} header`));
  } catch (error) {
    return Left(error instanceof Error ? error : new Error(String(error)));
  }
}
