import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import { ProvideMptDescriptorCommand } from "@internal/app-binder/command/ProvideMptDescriptorCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { type MptContext } from "@internal/app-binder/task/BuildMptContextTask";

import { ProvideMptContextTask } from "./ProvideMptContextTask";

const certificate = { keyUsageNumber: 8, payload: new Uint8Array([0x01]) };
const context = (payload: string): MptContext => ({
  type: ClearSignContextType.XRP_MPT,
  payload,
  certificate,
});

describe("ProvideMptContextTask", () => {
  const api = makeDeviceActionInternalApiMock();

  const sentCommands = () =>
    api.sendCommand.mock.calls.map(([command]) => command);

  beforeEach(() => {
    vi.clearAllMocks();
    api.sendCommand.mockResolvedValue(
      CommandResultFactory({ data: undefined }),
    );
  });

  it("should load the certificate, then the descriptor, of each MPT", async () => {
    await new ProvideMptContextTask(api, {
      contexts: [context("aa"), context("bb")],
    }).run();

    expect(sentCommands()).toEqual([
      new LoadCertificateCommand({
        certificate: certificate.payload,
        keyUsage: 8,
      }),
      new ProvideMptDescriptorCommand({ descriptor: new Uint8Array([0xaa]) }),
      new LoadCertificateCommand({
        certificate: certificate.payload,
        keyUsage: 8,
      }),
      new ProvideMptDescriptorCommand({ descriptor: new Uint8Array([0xbb]) }),
    ]);
  });

  it("should skip the descriptor whose certificate is refused", async () => {
    api.sendCommand
      .mockResolvedValueOnce(
        CommandResultFactory({ error: new UnknownDeviceExchangeError("6a80") }),
      )
      .mockResolvedValue(CommandResultFactory({ data: undefined }));

    await new ProvideMptContextTask(api, {
      contexts: [context("aa"), context("bb")],
    }).run();

    expect(sentCommands()).toEqual([
      new LoadCertificateCommand({
        certificate: certificate.payload,
        keyUsage: 8,
      }),
      new LoadCertificateCommand({
        certificate: certificate.payload,
        keyUsage: 8,
      }),
      new ProvideMptDescriptorCommand({ descriptor: new Uint8Array([0xbb]) }),
    ]);
  });

  it("should send a descriptor without certificate as is", async () => {
    await new ProvideMptContextTask(api, {
      contexts: [{ type: ClearSignContextType.XRP_MPT, payload: "aa" }],
    }).run();

    expect(sentCommands()).toEqual([
      new ProvideMptDescriptorCommand({ descriptor: new Uint8Array([0xaa]) }),
    ]);
  });

  it("should skip a context that is not an MPT", async () => {
    await new ProvideMptContextTask(api, {
      contexts: [{ type: ClearSignContextType.TRON_TOKEN, payload: "aa" }],
    }).run();

    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("should skip a payload that is not hex", async () => {
    await new ProvideMptContextTask(api, {
      contexts: [context("not-hex")],
    }).run();

    expect(api.sendCommand).not.toHaveBeenCalled();
  });
});
