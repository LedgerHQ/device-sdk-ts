import { EitherAsync, Right } from "purify-ts";
import { afterEach, beforeEach, vi } from "vitest";

import { type MockServerConfig } from "@api/model/MockServerConfig";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { type SpeculosProxySession } from "@internal/session/model/SessionModels";
import { SessionSweeperService } from "@internal/session/service/SessionSweeperService";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";

const proxy = (runId: string): SpeculosProxySession => ({
  runId,
  speculosUrl: `https://${runId}.test`,
  appName: "Bitcoin",
});

const makeRepo = (sweepReturns: SpeculosProxySession[][]) => {
  const sweep = vi.fn();
  sweepReturns.forEach((value) => sweep.mockReturnValueOnce(value));
  sweep.mockReturnValue([]);
  return { sweep } as unknown as SessionRepository & { sweep: typeof sweep };
};

const makeOperator = () =>
  ({
    release: vi.fn(() => EitherAsync.liftEither(Right(undefined))),
  }) as unknown as SpeculosOperatorDataSource & {
    release: ReturnType<typeof vi.fn>;
  };

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("SessionSweeperService", () => {
  it("sweeps the repository on each interval tick", () => {
    const repo = makeRepo([]);
    const service = new SessionSweeperService(repo, { sweepIntervalMs: 1000 });

    const stop = service.start();
    expect(repo.sweep).not.toHaveBeenCalled();

    vi.advanceTimersByTime(3000);
    expect(repo.sweep).toHaveBeenCalledTimes(3);
    stop();
  });

  it("releases the Speculos instances of evicted sessions", () => {
    const repo = makeRepo([[proxy("run-1"), proxy("run-2")]]);
    const operator = makeOperator();
    const service = new SessionSweeperService(
      repo,
      { sweepIntervalMs: 1000 },
      operator,
    );

    const stop = service.start();
    vi.advanceTimersByTime(1000);

    expect(operator.release).toHaveBeenCalledTimes(2);
    expect(operator.release).toHaveBeenCalledWith("run-1");
    expect(operator.release).toHaveBeenCalledWith("run-2");
    stop();
  });

  it("stops sweeping once the returned disposer is called", () => {
    const repo = makeRepo([]);
    const service = new SessionSweeperService(repo, { sweepIntervalMs: 1000 });

    const stop = service.start();
    vi.advanceTimersByTime(1000);
    stop();
    vi.advanceTimersByTime(5000);

    expect(repo.sweep).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when the interval is disabled (<= 0)", () => {
    const repo = makeRepo([]);
    const config: MockServerConfig = { sweepIntervalMs: 0 };
    const service = new SessionSweeperService(repo, config);

    const stop = service.start();
    vi.advanceTimersByTime(10000);

    expect(repo.sweep).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });
});
