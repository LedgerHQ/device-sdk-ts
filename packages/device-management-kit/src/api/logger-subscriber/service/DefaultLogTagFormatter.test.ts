import { describe, expect, it } from "vitest";

import { DefaultLogTagFormatter } from "./DefaultLogTagFormatter";

describe("DefaultLogTagFormatter", () => {
  const formatter = new DefaultLogTagFormatter();

  describe("format", () => {
    it("should format a single string tag with brackets", () => {
      expect(formatter.format("myTag")).toBe("[myTag]");
    });

    it("should format an empty string tag with brackets", () => {
      expect(formatter.format("")).toBe("[]");
    });

    it("should format a single element array with brackets", () => {
      expect(formatter.format(["myTag"])).toBe("[myTag]");
    });

    it("should format multiple tags with brackets separated by spaces", () => {
      expect(formatter.format(["tag1", "tag2", "tag3"])).toBe(
        "[tag1] [tag2] [tag3]",
      );
    });

    it("should format an empty array as empty string", () => {
      expect(formatter.format([])).toBe("");
    });

    it("should handle tags with special characters", () => {
      expect(formatter.format(["SignerEth", "ContextModule", "loader"])).toBe(
        "[SignerEth] [ContextModule] [loader]",
      );
    });
  });
});
