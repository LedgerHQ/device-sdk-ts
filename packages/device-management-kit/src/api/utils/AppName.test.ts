import { isDashboardName } from "./AppName";

describe("AppName", () => {
  describe("isDashboardName", () => {
    it("should return true if the value is BOLOS", () => {
      // GIVEN
      const value = "BOLOS";

      // WHEN
      const result = isDashboardName(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return true if the value is OLOS", () => {
      // GIVEN
      const value = "OLOS\0";

      // WHEN
      const result = isDashboardName(value);

      // THEN
      expect(result).toBeTruthy();
    });

    it("should return false if the value is Bitcoin", () => {
      // GIVEN
      const value = "Bitcoin";

      // WHEN
      const result = isDashboardName(value);

      // THEN
      expect(result).toBeFalsy();
    });
  });
});
