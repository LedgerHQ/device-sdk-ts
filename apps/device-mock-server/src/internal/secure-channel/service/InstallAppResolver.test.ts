import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemorySessionRepository } from "@internal/session/data/InMemorySessionRepository";
import { type SessionRecord } from "@internal/session/model/SessionModels";

import { InstallAppResolver } from "./InstallAppResolver";

const MANAGER_API_URL = "https://manager.test/api";

const setup = (catalog?: { hash: string; name: string; version: string }[]) => {
  const repo = new InMemorySessionRepository({
    managerApiUrl: MANAGER_API_URL,
  });
  const { token } = repo.createSession();
  const record = repo.findByToken(token).unsafeCoerce();
  if (catalog) {
    repo.addDevice(record, { device_type: "nanoX", catalog });
  }
  const resolver = new InstallAppResolver(
    { managerApiUrl: MANAGER_API_URL },
    repo,
  );
  return { resolver, record };
};

const mockFetch = (impl: () => Promise<Response>) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(impl);

const json = (body: unknown): Promise<Response> =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

describe("InstallAppResolver", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the seeded catalog app without hitting the Manager API", async () => {
    const app = { hash: "abc", name: "Bitcoin", version: "2.1.0" };
    const { resolver, record } = setup([app]);
    const fetchSpy = mockFetch(() => json([]));

    expect((await resolver.resolve(record, "abc")).extract()).toEqual(app);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resolves an unknown hash via the Manager API /v2/apps/hash endpoint", async () => {
    const { resolver, record } = setup();
    const fetchSpy = mockFetch(() =>
      json([{ versionName: "Ethereum", version: "1.10.0" }]),
    );

    const resolved = await resolver.resolve(
      record as SessionRecord,
      "deadbeef",
    );
    expect(resolved.extract()).toEqual({
      hash: "deadbeef",
      name: "Ethereum",
      version: "1.10.0",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      `${MANAGER_API_URL}/v2/apps/hash`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(["deadbeef"]),
      }),
    );
  });

  it("returns empty when the Manager API has no app for the hash", async () => {
    const { resolver, record } = setup();
    mockFetch(() => json([null]));
    expect((await resolver.resolve(record, "nope")).isNothing()).toBe(true);
  });

  it("returns empty when the Manager API call fails", async () => {
    const { resolver, record } = setup();
    mockFetch(() => Promise.reject(new Error("network down")));
    expect((await resolver.resolve(record, "boom")).isNothing()).toBe(true);
  });
});
