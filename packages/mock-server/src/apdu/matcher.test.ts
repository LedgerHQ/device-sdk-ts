import { type Mock } from "@ledgerhq/device-mockserver-client";

import { UNKNOWN_APDU_RESPONSE } from "../defaults";
import { matchApdu } from "./matcher";

const mock = (prefix: string, response: string): Mock => ({
  id: prefix,
  prefix,
  response,
});

describe("matchApdu", () => {
  it("matches a mock by APDU prefix", () => {
    const mocks = [mock("e0010000", "abcd9000")];
    expect(matchApdu("e001000000", mocks)).toBe("abcd9000");
  });

  it("is case-insensitive", () => {
    const mocks = [mock("E0010000", "ABCD9000")];
    expect(matchApdu("e001000000", mocks)).toBe("ABCD9000");
  });

  it("prefers the longest matching prefix", () => {
    const mocks = [mock("e0", "short9000"), mock("e0010000", "long9000")];
    expect(matchApdu("e001000000", mocks)).toBe("long9000");
  });

  it("prefers the most recently added mock among equal prefixes", () => {
    const mocks = [
      mock("b0010000", "default9000"),
      mock("b0010000", "seeded9000"),
    ];
    expect(matchApdu("b001000000", mocks)).toBe("seeded9000");
  });

  it("falls back to the not-supported status word when nothing matches", () => {
    expect(matchApdu("b0010000", [mock("e0010000", "abcd9000")])).toBe(
      UNKNOWN_APDU_RESPONSE,
    );
  });
});
