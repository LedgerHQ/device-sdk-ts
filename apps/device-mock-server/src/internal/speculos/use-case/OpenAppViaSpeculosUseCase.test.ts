import { EitherAsync, Left, Right } from "purify-ts";
import { vi } from "vitest";

import { InMemorySessionRepository } from "@internal/session/data/InMemorySessionRepository";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { SpeculosError } from "@internal/speculos/model/SpeculosModels";
import { OpenAppViaSpeculosUseCase } from "@internal/speculos/use-case/OpenAppViaSpeculosUseCase";

const makeOperator = (
  overrides: Partial<SpeculosOperatorDataSource> = {},
): SpeculosOperatorDataSource => ({
  acquire: vi.fn(() => EitherAsync.liftEither(Right("run-1"))),
  waitUntilReady: vi.fn(() =>
    EitherAsync.liftEither(Right("https://run-1.speculos.test")),
  ),
  release: vi.fn(() => EitherAsync.liftEither(Right(undefined))),
  forwardApdu: vi.fn(() => EitherAsync.liftEither(Right("9000"))),
  proxyRequest: vi.fn(() =>
    EitherAsync.liftEither(
      Right({
        status: 200,
        contentType: "application/json",
        body: Buffer.from("{}"),
      }),
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
  return { repo, record, device };
};

describe("OpenAppViaSpeculosUseCase", () => {
  it("rejects an app that is not installed", async () => {
    const { repo, record, device } = setup();
    const operator = makeOperator();
    const result = await new OpenAppViaSpeculosUseCase(operator, repo)
      .execute(record, device, "Ethereum")
      .run();
    expect(result.swap().extract()).toEqual({ _tag: "AppNotInstalled" });
    expect(operator.acquire).not.toHaveBeenCalled();
  });

  it("acquires speculos and records the proxy on success", async () => {
    const { repo, record, device } = setup();
    const operator = makeOperator();
    const result = await new OpenAppViaSpeculosUseCase(operator, repo)
      .execute(record, device, "Bitcoin")
      .run();
    expect(result.isRight()).toBe(true);
    expect(operator.acquire).toHaveBeenCalledWith(
      {
        coin_app: "Bitcoin",
        coin_app_version: "2.1.0",
        device: "nanox",
        device_os_version: "1.3.0",
      },
      expect.any(String),
    );
    expect(repo.findProxy(record, device.id).extract()).toMatchObject({
      speculosUrl: "https://run-1.speculos.test",
      appName: "Bitcoin",
    });
  });

  it("releases and fails when the operator errors", async () => {
    const { repo, record, device } = setup();
    const operator = makeOperator({
      acquire: vi.fn(() =>
        EitherAsync.liftEither(Left(new SpeculosError("boom"))),
      ),
    });
    const result = await new OpenAppViaSpeculosUseCase(operator, repo)
      .execute(record, device, "Bitcoin")
      .run();
    expect(result.swap().extract()).toMatchObject({ _tag: "OperatorError" });
    expect(operator.release).toHaveBeenCalled();
    expect(repo.findProxy(record, device.id).isNothing()).toBe(true);
  });
});
