import { EitherAsync, Left, Right } from "purify-ts";
import { vi } from "vitest";

import { type SpeculosProxySession } from "@internal/session/model/SessionModels";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { SpeculosError } from "@internal/speculos/model/SpeculosModels";
import { ForwardApduUseCase } from "@internal/speculos/use-case/ForwardApduUseCase";

const proxy: SpeculosProxySession = {
  runId: "run-1",
  speculosUrl: "https://r.speculos.test",
  appName: "Bitcoin",
};

const makeOperator = (
  overrides: Partial<SpeculosOperatorDataSource> = {},
): SpeculosOperatorDataSource => ({
  acquire: vi.fn(() => EitherAsync.liftEither(Right("run-1"))),
  waitUntilReady: vi.fn(() => EitherAsync.liftEither(Right("https://x.test"))),
  release: vi.fn(() => EitherAsync.liftEither(Right(undefined))),
  forwardApdu: vi.fn(() => EitherAsync.liftEither(Right("deadbeef9000"))),
  proxyRequest: vi.fn(() =>
    EitherAsync.liftEither(
      Right({ status: 200, contentType: null, body: Buffer.from("") }),
    ),
  ),
  ...overrides,
});

describe("ForwardApduUseCase", () => {
  it("forwards the APDU to the proxy's speculos url", async () => {
    const operator = makeOperator();
    const result = await new ForwardApduUseCase(operator)
      .execute(proxy, "b001000000")
      .run();

    expect(result.extract()).toBe("deadbeef9000");
    expect(operator.forwardApdu).toHaveBeenCalledWith(
      "https://r.speculos.test",
      "b001000000",
    );
  });

  it("propagates operator errors", async () => {
    const operator = makeOperator({
      forwardApdu: vi.fn(() =>
        EitherAsync.liftEither(Left(new SpeculosError("boom"))),
      ),
    });
    const result = await new ForwardApduUseCase(operator)
      .execute(proxy, "b001000000")
      .run();

    expect(result.isLeft()).toBe(true);
    expect(result.leftToMaybe().extract()?.message).toBe("boom");
  });
});
