import {
  BTC_LEGACY_ERRORS,
  BtcLegacyAppCommandError,
} from "./btcLegacyApplicationErrors";

describe("BTC_LEGACY_ERRORS", () => {
  it("should create a BtcLegacyAppCommandError from a status word", () => {
    const error = BTC_LEGACY_ERRORS.factory({
      ...BTC_LEGACY_ERRORS.errors["6985"],
      errorCode: "6985",
    });

    expect(error).toBeInstanceOf(BtcLegacyAppCommandError);
    expect(error).toMatchObject({
      _tag: "BtcLegacyAppCommandError",
      errorCode: "6985",
      message: "UserRejectedError",
    });
  });
});
