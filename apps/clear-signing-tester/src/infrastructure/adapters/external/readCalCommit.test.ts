import { Left, Right } from "purify-ts";
import { describe, expect, it, vi } from "vitest";

import { readCalCommit } from "./readCalCommit";

const COMMIT = "c8176160a1b2c3d4e5f60718293a4b5c6d7e8f90";

const answering = (response: Response) =>
  vi.fn<typeof fetch>().mockResolvedValue(response);

describe("readCalCommit", () => {
  it("asks CAL for the branch with the cheapest request carrying a ref", async () => {
    const fetchFn = answering(
      new Response("[]", { headers: { "X-Ledger-Commit": COMMIT } }),
    );

    await readCalCommit("next", fetchFn);

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(
      "https://global.api.prd.ledger.com/cal/v1/tokens?limit=1&output=id&ref=branch:next",
    );
    // The commit only labels the run, so a stuck request must not hold it up.
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  // CAL sends it lower-cased; Headers matches it either way.
  it("returns the commit CAL names in X-Ledger-Commit", async () => {
    const fetchFn = answering(
      new Response("[]", { headers: { "x-ledger-commit": COMMIT } }),
    );

    await expect(readCalCommit("next", fetchFn)).resolves.toEqual(
      Right(COMMIT),
    );
  });

  it("fails when the response names no commit", async () => {
    const fetchFn = answering(new Response("[]"));

    const result = await readCalCommit("next", fetchFn);

    expect(result.isLeft()).toBe(true);
    expect(result.extract()).toEqual(
      new Error(
        "GET https://global.api.prd.ledger.com/cal/v1/tokens?limit=1&output=id&ref=branch:next " +
          "returned no X-Ledger-Commit header",
      ),
    );
  });

  // A failed request says nothing about the branch, even with the header.
  it("fails on a non-2xx response, header or not", async () => {
    const fetchFn = answering(
      new Response("unknown ref", {
        status: 400,
        headers: { "X-Ledger-Commit": COMMIT },
      }),
    );

    const result = await readCalCommit("demo", fetchFn);

    expect(result.isLeft()).toBe(true);
    expect((result.extract() as Error).message).toMatch(/failed with 400$/);
  });

  it("fails rather than throws when the request does", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("fetch failed"));

    await expect(readCalCommit("next", fetchFn)).resolves.toEqual(
      Left(new TypeError("fetch failed")),
    );
  });
});
