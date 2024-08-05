import { CommandResponse, CommandResponseArgs } from "./CommandResponse";

export const commandResponseStubBuilder = (
  args: Partial<CommandResponseArgs> = {},
) =>
  new CommandResponse({
    response: "RESPONSE",
    ...args,
  });
