import {
  type CommandResult,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  IcpAppCommandError,
  type IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";

// Asserts a parseResponse result failed with the given ICP status-word error.
// Shared by the command tests so the unwrap boilerplate lives in one place.
export const expectStatusWordError = <T>(
  result: CommandResult<T, IcpErrorCodes>,
  expected: IcpErrorCodes,
): void => {
  expect(isSuccessCommandResult(result)).toBe(false);
  if (!isSuccessCommandResult(result)) {
    const err = result.error as IcpAppCommandError;
    expect(err).toBeInstanceOf(IcpAppCommandError);
    expect(err.errorCode).toBe(expected);
  }
};
