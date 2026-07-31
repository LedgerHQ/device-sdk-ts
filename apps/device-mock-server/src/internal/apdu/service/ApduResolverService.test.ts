import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import { vi } from "vitest";

import { ApduResolverService } from "@internal/apdu/service/ApduResolverService";
import { OsApduService } from "@internal/os/service/OsApduService";
import { type FirmwareUpdateResolver } from "@internal/secure-channel/service/FirmwareUpdateResolver";
import { INSTALL_COMMIT_APDU } from "@internal/secure-channel/service/secureChannelApdus";
import { SecureChannelApduService } from "@internal/secure-channel/service/SecureChannelApduService";
import { InMemorySessionRepository } from "@internal/session/data/InMemorySessionRepository";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { SpeculosError } from "@internal/speculos/model/SpeculosModels";
import { CloseAppUseCase } from "@internal/speculos/use-case/CloseAppUseCase";
import { ForwardApduUseCase } from "@internal/speculos/use-case/ForwardApduUseCase";
import { type OpenAppViaSpeculosUseCase } from "@internal/speculos/use-case/OpenAppViaSpeculosUseCase";

// e0 d8 00 00 07 "Bitcoin"
const OPEN_BITCOIN = "e0d8000007426974636f696e";

const makeOperator = (
  overrides: Partial<SpeculosOperatorDataSource> = {},
): SpeculosOperatorDataSource => ({
  acquire: vi.fn(() => EitherAsync.liftEither(Right("run-1"))),
  waitUntilReady: vi.fn(() => EitherAsync.liftEither(Right("https://x.test"))),
  release: vi.fn(() => EitherAsync.liftEither(Right(undefined))),
  forwardApdu: vi.fn(() => EitherAsync.liftEither(Right("deadbeef9000"))),
  proxyRequest: vi.fn(() =>
    EitherAsync.liftEither(
      Right({ status: 200, contentType: "application/json", body: "{}" }),
    ),
  ),
  ...overrides,
});

const stubFirmwareResolver: FirmwareUpdateResolver = {
  resolveNextVersion: vi.fn().mockResolvedValue(Maybe.empty()),
  resolveCurrentMcuVersion: vi.fn().mockResolvedValue(Maybe.of("2.30")),
} as unknown as FirmwareUpdateResolver;

const setup = () => {
  const repo = new InMemorySessionRepository({});
  const { token } = repo.createSession();
  const record = repo.findByToken(token).unsafeCoerce();
  const device = repo.addDevice(record, {
    device_type: "nanoX",
    firmware_version: "1.3.0",
    apps: [{ name: "Bitcoin", version: "2.1.0" }],
  });
  const os = new OsApduService(stubFirmwareResolver);
  const secureChannel = new SecureChannelApduService();
  return { repo, record, device, os, secureChannel };
};

describe("ApduResolverService", () => {
  it("forwards APDUs while a speculos proxy is active", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    repo.setProxy(record, device.id, {
      runId: "run-1",
      speculosUrl: "https://x.test",
      appName: "Bitcoin",
    });
    const operator = makeOperator();
    const resolver = new ApduResolverService(
      repo,
      os,
      secureChannel,
      undefined,
      new ForwardApduUseCase(operator),
      new CloseAppUseCase(operator, repo),
    );
    const response = await resolver.resolve(record, device, "b001000000");
    expect(response).toBe("deadbeef9000");
  });

  it("releases and reverts to mock mode on close app", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    repo.setProxy(record, device.id, {
      runId: "run-1",
      speculosUrl: "https://x.test",
      appName: "Bitcoin",
    });
    const operator = makeOperator();
    const resolver = new ApduResolverService(
      repo,
      os,
      secureChannel,
      undefined,
      new ForwardApduUseCase(operator),
      new CloseAppUseCase(operator, repo),
    );
    const response = await resolver.resolve(record, device, "b0a7000000");
    expect(response).toBe("9000");
    expect(operator.release).toHaveBeenCalledWith("run-1");
    expect(repo.findProxy(record, device.id).isNothing()).toBe(true);
  });

  it("lets an explicit mock override the active speculos proxy", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    repo.setProxy(record, device.id, {
      runId: "run-1",
      speculosUrl: "https://x.test",
      appName: "Bitcoin",
    });
    // Mock GetAppAndVersion to a "device locked" status word.
    repo.addMock(record, device.id, { prefix: "b0010000", response: "5515" });
    const operator = makeOperator();
    const resolver = new ApduResolverService(
      repo,
      os,
      secureChannel,
      undefined,
      new ForwardApduUseCase(operator),
      new CloseAppUseCase(operator, repo),
    );

    const response = await resolver.resolve(record, device, "b0010000");

    expect(response).toBe("5515");
    expect(operator.forwardApdu).not.toHaveBeenCalled();
    // The proxy stays active for non-mocked APDUs.
    expect(repo.findProxy(record, device.id).isJust()).toBe(true);
  });

  it("serves an explicit mock over the derived OS handshake", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    repo.addMock(record, device.id, {
      prefix: "e0010000",
      response: "deadbeef9000",
    });
    const resolver = new ApduResolverService(repo, os, secureChannel);
    expect(await resolver.resolve(record, device, "e0010000")).toBe(
      "deadbeef9000",
    );
  });

  it("derives the handshake responses when unmocked", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    const resolver = new ApduResolverService(repo, os, secureChannel);
    const osVersion = await resolver.resolve(record, device, "e0010000");
    const appAndVersion = await resolver.resolve(record, device, "b0010000");
    expect(osVersion.startsWith("33000004")).toBe(true);
    expect(appAndVersion).toBe("0105424f4c4f5305312e332e309000");
  });

  it("maps open-app outcomes to status words", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    const openApp = {
      execute: vi.fn(() =>
        EitherAsync.liftEither(
          Right({
            runId: "r",
            speculosUrl: "https://x.test",
            appName: "Bitcoin",
          }),
        ),
      ),
    } as unknown as OpenAppViaSpeculosUseCase;
    const resolver = new ApduResolverService(repo, os, secureChannel, openApp);
    expect(await resolver.resolve(record, device, OPEN_BITCOIN)).toBe("9000");

    (openApp.execute as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      EitherAsync.liftEither(Left({ _tag: "AppNotInstalled" })),
    );
    expect(await resolver.resolve(record, device, OPEN_BITCOIN)).toBe("6807");

    (openApp.execute as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      EitherAsync.liftEither(
        Left({ _tag: "OperatorError", error: new SpeculosError("x") }),
      ),
    );
    expect(await resolver.resolve(record, device, OPEN_BITCOIN)).toBe("6d00");
  });

  it("falls back to 6d00 for an unmatched non-derivable APDU", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    const resolver = new ApduResolverService(repo, os, secureChannel);
    expect(await resolver.resolve(record, device, "e0bb000000")).toBe("6d00");
  });

  it("does not intercept open app without an operator/use-case", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    const resolver = new ApduResolverService(repo, os, secureChannel);
    expect(await resolver.resolve(record, device, OPEN_BITCOIN)).toBe("6d00");
  });

  it("commits a pending firmware operation when the final install block succeeds", async () => {
    const { repo, record, device, os, secureChannel } = setup();
    const resolver = new ApduResolverService(repo, os, secureChannel);
    repo.setPendingFirmwareOperation(record, device.id, "1.9.1-osu");

    // The final install block derives to success and triggers the commit.
    expect(await resolver.resolve(record, device, INSTALL_COMMIT_APDU)).toBe(
      "9000",
    );
    expect(
      repo.findDevice(record, device.id).unsafeCoerce().firmware_version,
    ).toBe("1.9.1-osu");
    // The pending operation was cleared.
    expect(
      repo.commitPendingFirmwareOperation(record, device.id).isNothing(),
    ).toBe(true);
  });
});
