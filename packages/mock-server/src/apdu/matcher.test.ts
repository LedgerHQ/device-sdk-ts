import { type Mock } from "@ledgerhq/device-mockserver-client";

import { matchApdu } from "./matcher";

const mock = (prefix: string, ...responses: string[]): Mock => ({
  id: `${prefix}-${responses.join("-")}`,
  prefix,
  responses,
});

describe("matchApdu", () => {
  it("matches a mock by APDU prefix", () => {
    const target = mock("e0010000", "abcd9000");
    expect(matchApdu("e001000000", [target])).toBe(target);
  });

  it("is case-insensitive", () => {
    const target = mock("E0010000", "ABCD9000");
    expect(matchApdu("e001000000", [target])).toBe(target);
  });

  it("prefers the longest matching prefix", () => {
    const long = mock("e0010000", "long9000");
    const mocks = [mock("e0", "short9000"), long];
    expect(matchApdu("e001000000", mocks)).toBe(long);
  });

  it("prefers the most recently added mock among equal prefixes", () => {
    const seeded = mock("b0010000", "seeded9000");
    const mocks = [mock("b0010000", "default9000"), seeded];
    expect(matchApdu("b001000000", mocks)).toBe(seeded);
  });

  it("returns undefined when nothing matches", () => {
    expect(
      matchApdu("b0010000", [mock("e0010000", "abcd9000")]),
    ).toBeUndefined();
  });
});
