import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { EditLedgerAccountCommand } from "@internal/app-binder/command/EditLedgerAccountCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendEditLedgerAccountTask } from "./SendEditLedgerAccountTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const TASK_ARGS = {
  name: "Safe",
  oldName: "Vault",
  derivationPath: "44'/60'/0'/0/0",
  chainId: 1,
  hmacProofHex: "ee".repeat(32),
};

const ROTATED_PROOF_HEX = "ab".repeat(32);

describe("SendEditLedgerAccountTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sends a single EditLedgerAccountCommand and returns the rotated hmacProofHex", async () => {
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({ data: { hmacProofHex: ROTATED_PROOF_HEX } }),
    );

    const result = await new SendEditLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new EditLedgerAccountCommand(TASK_ARGS),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({ data: { hmacProofHex: ROTATED_PROOF_HEX } }),
    );
  });

  it("propagates the command error (e.g. seed mismatch)", async () => {
    const error = CommandResultFactory({
      error: new InvalidStatusWordError("seed mismatch"),
    });
    apiMock.sendCommand.mockResolvedValueOnce(error);

    const result = await new SendEditLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(result).toBe(error);
  });
});
