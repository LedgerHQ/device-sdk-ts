import { accountReset, witnessedScope } from "./__tests__/fixtures/calBuilders";
import { checkResetIndices } from "./resetIndices";

describe("checkResetIndices", () => {
  it("passes when every index is in range", () => {
    expect(
      checkResetIndices(
        [
          accountReset({ accountIndex: 1 }),
          accountReset({
            accountIndex: 2,
            resetScope: witnessedScope("Jup", 0, [["96564774a75d0e68", 7]]),
          }),
        ],
        3,
      ),
    ).toBeNull();
  });

  it("passes when there is no reset", () => {
    expect(checkResetIndices([], 0)).toBeNull();
  });

  it("fails on an ACCOUNT_INDEX past the last account", () => {
    expect(checkResetIndices([accountReset({ accountIndex: 3 })], 3)).toMatch(
      /account_index 3 is out of range \(3 accounts\)/,
    );
  });

  it("fails on a WITNESS_RESET_INDEX past the last account", () => {
    expect(
      checkResetIndices(
        [
          accountReset({
            accountIndex: 1,
            resetScope: witnessedScope("Jup", 5, [["96564774a75d0e68", 7]]),
          }),
        ],
        2,
      ),
    ).toMatch(/reset_account_index 5 is out of range \(2 accounts\)/);
  });

  it("does not check a consumer's index, which points into another instruction", () => {
    expect(
      checkResetIndices(
        [
          accountReset({
            accountIndex: 1,
            resetScope: witnessedScope("Jup", 0, [["96564774a75d0e68", 200]]),
          }),
        ],
        2,
      ),
    ).toBeNull();
  });
});
