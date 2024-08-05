import { Mock, MockArgs } from "./Mock";

export const mockStubBuilder = (args: Partial<MockArgs> = {}) =>
  new Mock({
    prefix: "B001",
    response: "9000",
    ...args,
  });
