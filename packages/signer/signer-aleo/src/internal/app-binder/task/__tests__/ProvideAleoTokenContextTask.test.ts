import {
  AleoContextTypes,
  type AleoTransactionContextResult,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  InvalidStatusWordError,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/task/__test-utils__/makeInternalApi";
import { ProvideAleoTokenContextTask } from "@internal/app-binder/task/ProvideAleoTokenContextTask";

const CERTIFICATE_PAYLOAD = new Uint8Array([0x01, 0x02, 0x03]);
const CERTIFICATE_KEY_USAGE = 8;
const DESCRIPTOR_DATA_HEX = "deadbeef";
const DESCRIPTOR_SIG_HEX = "aa".repeat(70);

const SUCCESS_RESULT = CommandResultFactory({ data: undefined });
const makeSuccessContext = (): AleoTransactionContextResult => ({
  loadersResults: [
    {
      type: AleoContextTypes.ALEO_TOKEN,
      payload: {
        aleoTokenDescriptor: {
          data: DESCRIPTOR_DATA_HEX,
          signature: DESCRIPTOR_SIG_HEX,
        },
      },
      certificate: {
        payload: CERTIFICATE_PAYLOAD,
        keyUsageNumber: CERTIFICATE_KEY_USAGE,
      },
    },
  ],
});

describe("ProvideAleoTokenContextTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends LoadCertificateCommand then ProvideTokenInformationCommand in order", async () => {
    apiMock.sendCommand.mockResolvedValue(SUCCESS_RESULT);

    await new ProvideAleoTokenContextTask(apiMock, {
      aleoTransactionContext: makeSuccessContext(),
    }).run();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    const firstCall = apiMock.sendCommand.mock.calls[0]?.[0];
    const secondCall = apiMock.sendCommand.mock.calls[1]?.[0];
    expect(firstCall).toBeInstanceOf(LoadCertificateCommand);
    expect(secondCall).toBeInstanceOf(ProvideTokenInformationCommand);
  });

  it("passes correct payload and keyUsage to LoadCertificateCommand", async () => {
    apiMock.sendCommand.mockResolvedValue(SUCCESS_RESULT);

    await new ProvideAleoTokenContextTask(apiMock, {
      aleoTransactionContext: makeSuccessContext(),
    }).run();

    const certCommand = apiMock.sendCommand.mock
      .calls[0]?.[0] as LoadCertificateCommand;
    expect(certCommand.args.certificate).toEqual(CERTIFICATE_PAYLOAD);
    expect(certCommand.args.keyUsage).toBe(CERTIFICATE_KEY_USAGE);
  });

  it("throws if LoadCertificateCommand fails and does not send ProvideTokenInformationCommand", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: new InvalidStatusWordError("cert failed"),
      }),
    );

    await expect(
      new ProvideAleoTokenContextTask(apiMock, {
        aleoTransactionContext: makeSuccessContext(),
      }).run(),
    ).rejects.toThrow("Failed to load PKI certificate");

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("sends no commands when loadersResults is empty", async () => {
    await new ProvideAleoTokenContextTask(apiMock, {
      aleoTransactionContext: { loadersResults: [] },
    }).run();

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("skips ERROR type loader results without sending any command", async () => {
    await new ProvideAleoTokenContextTask(apiMock, {
      aleoTransactionContext: {
        loadersResults: [
          { type: AleoContextTypes.ERROR, error: new Error("loader failed") },
        ],
      },
    }).run();

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("skips ALEO_TOKEN entries that have no certificate", async () => {
    await new ProvideAleoTokenContextTask(apiMock, {
      aleoTransactionContext: {
        loadersResults: [
          {
            type: AleoContextTypes.ALEO_TOKEN,
            payload: {
              aleoTokenDescriptor: {
                data: DESCRIPTOR_DATA_HEX,
                signature: DESCRIPTOR_SIG_HEX,
              },
            },
            // certificate intentionally absent
          },
        ],
      },
    }).run();

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });
});
