import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { ApduResponse } from "@api/device-session/ApduResponse";

import {
  CommandResultFactory,
  CommandResultStatus,
  isSuccessCommandResult,
} from "./CommandResult";

describe("CommandResult", () => {
  describe("CommandResultFactory", () => {
    it("should create a success command result with given data", () => {
      // given
      const data = { lorem: "ipsum" };
      // when
      const result = CommandResultFactory({ data });
      // then
      expect(result).toStrictEqual({
        status: CommandResultStatus.Success,
        data,
      });
    });
    it("should create a failure command result with given error", () => {
      // given
      const error = GlobalCommandErrorHandler.handle(
        new ApduResponse({
          statusCode: Uint8Array.from([0x42, 0x00]),
          data: Uint8Array.from([]),
        }),
      );

      // when
      const result = CommandResultFactory({ error });

      // then
      expect(result).toStrictEqual({
        status: CommandResultStatus.Error,
        error,
      });
    });
  });

  describe("isSuccessCommandResult", () => {
    it("should return true if command result success", () => {
      // given
      const data = { test: "ttest" };
      // when
      const result = CommandResultFactory({ data });
      // then
      expect(isSuccessCommandResult(result)).toBeTruthy();
    });
    it("should return false if command result fails", () => {
      // given
      const error = GlobalCommandErrorHandler.handle(
        new ApduResponse({
          statusCode: Uint8Array.from([0x42, 0x00]),
          data: Uint8Array.from([]),
        }),
      );
      // when
      const result = CommandResultFactory({ error });
      // then
      expect(isSuccessCommandResult(result)).toBeFalsy();
    });
  });
});
