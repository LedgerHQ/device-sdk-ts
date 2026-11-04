import { parseFilterQuery } from "../logger/filterUtils";
import { matchesText } from "./apduFilter";

const matches = (text: string, query: string) =>
  matchesText(text, parseFilterQuery(query));

describe("matchesText", () => {
  it("matches everything without a query", () => {
    expect(matches("getAppAndVersion 9000", "")).toBe(true);
  });

  it("needs every keyword, ignoring case", () => {
    expect(matches("signPsbt e104 6985", "SIGNPSBT 6985")).toBe(true);
    expect(matches("signPsbt e104 9000", "signPsbt 6985")).toBe(false);
  });

  it("drops text that matches an excluded keyword", () => {
    expect(matches("getAppAndVersion b001", "-getAppAndVersion")).toBe(false);
    expect(matches("signPsbt e104", "-getAppAndVersion")).toBe(true);
  });

  it("supports regular expressions", () => {
    expect(matches("status 6a80", "/6a8[0-9]/")).toBe(true);
    expect(matches("status 9000", "-/^status 9/")).toBe(false);
  });
});
