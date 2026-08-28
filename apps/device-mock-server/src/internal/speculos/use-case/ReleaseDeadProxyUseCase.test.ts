import { EitherAsync, Right } from "purify-ts";
import { vi } from "vitest";

import { InMemorySessionRepository } from "@internal/session/data/InMemorySessionRepository";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { CloseAppUseCase } from "@internal/speculos/use-case/CloseAppUseCase";
import { ReleaseDeadProxyUseCase } from "@internal/speculos/use-case/ReleaseDeadProxyUseCase";

const makeOperator = (
  overrides: Partial<SpeculosOperatorDataSource> = {},
): SpeculosOperatorDataSource => ({
  acquire: vi.fn(() => EitherAsync.liftEither(Right("run-1"))),
  waitUntilReady: vi.fn(() => EitherAsync.liftEither(Right("https://x.test"))),
  release: vi.fn(() => EitherAsync.liftEither(Right(undefined))),
  isAlive: vi.fn(() => Promise.resolve(true)),
  forwardApdu: vi.fn(() => EitherAsync.liftEither(Right("9000"))),
  proxyRequest: vi.fn(() =>
    EitherAsync.liftEither(
      Right({ status: 200, contentType: null, body: Buffer.alloc(0) }),
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
  const proxy = repo.findProxy(record, device.id).unsafeCoerce();
  return { repo, record, device, proxy };
};

describe("ReleaseDeadProxyUseCase", () => {
  it("closes the app when the emulator is gone", async () => {
    const { repo, record, device, proxy } = setup();
    const operator = makeOperator({
      isAlive: vi.fn(() => Promise.resolve(false)),
    });

    const discarded = await new ReleaseDeadProxyUseCase(
      operator,
      new CloseAppUseCase(operator, repo),
    ).execute(record, device.id, proxy);

    expect(discarded).toBe(true);
    expect(operator.isAlive).toHaveBeenCalledWith("https://r.speculos.test");
    expect(operator.release).toHaveBeenCalledWith("run-1");
    expect(repo.findProxy(record, device.id).isNothing()).toBe(true);
  });

  it("keeps the proxy while the emulator still answers", async () => {
    const { repo, record, device, proxy } = setup();
    const operator = makeOperator();

    const discarded = await new ReleaseDeadProxyUseCase(
      operator,
      new CloseAppUseCase(operator, repo),
    ).execute(record, device.id, proxy);

    expect(discarded).toBe(false);
    expect(operator.release).not.toHaveBeenCalled();
    expect(repo.findProxy(record, device.id).isJust()).toBe(true);
  });
});
