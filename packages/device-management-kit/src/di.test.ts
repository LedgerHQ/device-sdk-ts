import { type DmkConfig } from "@api/DmkConfig";
import { transportDiTypes } from "@internal/transport/di/transportDiTypes";

import { makeContainer } from "./di";

describe("makeContainer", () => {
  it("should default mockUrl to the hosted mock server", () => {
    const container = makeContainer({});
    const transportConfig = container.get<DmkConfig>(
      transportDiTypes.DmkConfig,
    );

    expect(transportConfig.mockUrl).toBe(
      "https://device-mock-server.aws.ldg-ps-default.ldg-tech.com",
    );
  });
});
