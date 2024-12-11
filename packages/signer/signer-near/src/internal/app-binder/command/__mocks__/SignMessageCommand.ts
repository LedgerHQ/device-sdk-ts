import { type Command } from "@ledgerhq/device-management-kit";

import {
  type SignMessageCommandArgs,
  type SignMessageCommandResponse,
} from "@internal/app-binder/command/SignMessageCommand";
import { type SignCommandArgs } from "@internal/shared/utils/SignUtils";

export class SignMessageCommand
  implements Command<SignMessageCommandResponse, SignMessageCommandArgs>
{
  constructor(readonly args: SignCommandArgs) {}
  getApdu = jest.fn();
  parseResponse = jest.fn();
}
