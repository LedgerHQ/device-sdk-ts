import { CommandResponse } from "./CommandResponse";

describe("CommandResponse", () => {
  it("should have a response", () => {
    // GIVEN
    const response = "RESPONSE";

    // WHEN
    const cmdResponse = new CommandResponse({ response });

    // THEN
    expect(cmdResponse.response).toBe("RESPONSE");
  });
});
