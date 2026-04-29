import {
  DmkResultFactory,
  DmkResultStatus,
  isSuccessDmkResult,
} from "./DmkResult";

describe("DmkResult", () => {
  describe("DmkResultFactory", () => {
    it("should create a success result with given data", () => {
      const data = { lorem: "ipsum" };

      const result = DmkResultFactory({ data });

      expect(result).toStrictEqual({
        status: DmkResultStatus.Success,
        data,
      });
    });

    it("should create a success result when error is undefined", () => {
      const data = { lorem: "ipsum" };

      const result = DmkResultFactory({
        data,
        error: undefined,
      });

      expect(result).toStrictEqual({
        status: DmkResultStatus.Success,
        data,
      });
    });

    it("should create an error result with given error", () => {
      const error = new Error("test");

      const result = DmkResultFactory({ error });

      expect(result).toStrictEqual({
        status: DmkResultStatus.Error,
        error,
      });
    });
  });

  describe("isSuccessDmkResult", () => {
    it("should return true if dmk result succeeds", () => {
      const result = DmkResultFactory({ data: { test: "ttest" } });

      expect(isSuccessDmkResult(result)).toBeTruthy();
    });

    it("should return false if dmk result fails", () => {
      const result = DmkResultFactory({ error: new Error("test") });

      expect(isSuccessDmkResult(result)).toBeFalsy();
    });
  });
});
