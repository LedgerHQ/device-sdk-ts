import { EitherAsync, Right } from "purify-ts";
import { vi } from "vitest";

import { InMemorySessionRepository } from "@internal/session/data/InMemorySessionRepository";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { CloseAppUseCase } from "@internal/speculos/use-case/CloseAppUseCase";

const makeOperator = (
  overrides: Partial<SpeculosOperatorDataSource> = {},
): SpeculosOperatorDataSource => ({
  acquire: vi.fn(() => EitherAsync.liftEither(Right("run-1"))),
  waitUntilReady: vi.fn(() => EitherAsync.liftEither(Right("https://x.test"))),
  release: vi.fn(() => EitherAsync.liftEither(Right(undefined))),
  forwardApdu: vi.fn(() => EitherAsync.liftEither(Right("9000"))),
  proxyRequest: vi.fn(() =>
    EitherAsync.liftEither(
      Right({ status: 200, contentType: null, body: Buffer.from("") }),
    ),
  ),
  ...overrides,
});

const setup = () => {
  const repo = new InMemorySessionRepository({});
  const { token } = repo.createSession();
  const record = repo.findByToken(token).unsafeCoerce();
  const device = repo.addDevice(record, {
    device_type: "nanoX",
    firmware_version: "1.3.0",
    apps: [{ name: "Bitcoin", version: "2.1.0" }],
  });
  repo.setProxy(record, device.id, {
    runId: "run-1",
    speculosUrl: "https://r.speculos.test",
    appName: "Bitcoin",
  });
  return { repo, record, device };
};

describe("CloseAppUseCase", () => {
  it("forgets the proxy and releases the speculos instance", async () => {
    const { repo, record, device } = setup();
    const operator = makeOperator();
    const proxy = repo.findProxy(record, device.id).unsafeCoerce();

    const result = await new CloseAppUseCase(operator, repo)
      .execute(record, device.id, proxy)
      .run();

    expect(result.isRight()).toBe(true);
    expect(repo.findProxy(record, device.id).isNothing()).toBe(true);
    expect(operator.release).toHaveBeenCalledWith("run-1");
  });
});
