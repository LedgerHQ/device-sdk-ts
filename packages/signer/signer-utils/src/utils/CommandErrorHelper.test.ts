import {
  ApduResponse,
  CommandResultFactory,
  GlobalCommandErrorHandler,
} from "@ledgerhq/device-management-kit";

import { CommandErrorHelper } from "./CommandErrorHelper";

describe("CommandErrorHelper", () => {
  it("should return the correct error args and call factory when error is found", () => {
    // given
    const errors = {
      "4224": { message: "An error occurred" },
    };
    const errorFactory = vi.fn();
    const helper = new CommandErrorHelper(errors, errorFactory);
    const apduResponse = new ApduResponse({
      statusCode: Uint8Array.from([0x42, 0x24]),
      data: Uint8Array.from([]),
    });
    // when
    helper.getError(apduResponse);
    // then
    expect(errorFactory).toHaveBeenNthCalledWith(1, {
      ...errors["4224"],
      errorCode: "4224",
    });
  });
  it("should return a global error when no error is found", () => {
    // given
    const errors = {};
    const errorFactory = vi.fn();
    const helper = new CommandErrorHelper(errors, errorFactory);
    const apduResponse = new ApduResponse({
      statusCode: Uint8Array.from([0x55, 0x15]),
      data: Uint8Array.from([]),
    });
    // when
    const error = helper.getError(apduResponse);
    // then
    expect(errorFactory).toHaveBeenCalledTimes(0);
    expect(error).toStrictEqual(
      CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      }),
    );
  });
  it("should return undefined if success apdu response", () => {
    // given
    const errors = {};
    const errorFactory = vi.fn();
    const helper = new CommandErrorHelper(errors, errorFactory);
    const apduResponse = new ApduResponse({
      statusCode: Uint8Array.from([0x90, 0x00]),
      data: Uint8Array.from([]),
    });
    // when
    const error = helper.getError(apduResponse);
    // then
    expect(error).toBeUndefined();
  });
});
