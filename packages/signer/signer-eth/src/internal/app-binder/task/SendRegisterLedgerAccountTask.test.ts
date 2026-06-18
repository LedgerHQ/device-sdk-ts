import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { RegisterLedgerAccountCommand } from "@internal/app-binder/command/RegisterLedgerAccountCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendRegisterLedgerAccountTask } from "./SendRegisterLedgerAccountTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const TASK_ARGS = {
  name: "Alice",
  derivationPath: "44'/60'/0'/0/0",
  chainId: 1,
};

const HMAC_PROOF_HEX = "ab".repeat(32);

describe("SendRegisterLedgerAccountTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("dispatches both APDUs and returns combined { hmacProofHex, addressHex } with the address normalised", async () => {
    apiMock.sendCommand
      .mockResolvedValueOnce(
        CommandResultFactory({ data: { hmacProofHex: HMAC_PROOF_HEX } }),
      )
      .mockResolvedValueOnce(
        CommandResultFactory({
          data: { address: "0xDEADBEEFdeadbeefDEADBEEFdeadbeefDEADBEEF" },
        }),
      );

    const result = await new SendRegisterLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(2);
    expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
      new RegisterLedgerAccountCommand(TASK_ARGS),
    );
    expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
      new GetAddressCommand({
        derivationPath: TASK_ARGS.derivationPath,
        checkOnDevice: false,
        returnChainCode: false,
        chainId: TASK_ARGS.chainId,
      }),
    );
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          hmacProofHex: HMAC_PROOF_HEX,
          addressHex: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        },
      }),
    );
  });

  it("returns the Register error without invoking GetAddress when the first APDU fails", async () => {
    const registerError = CommandResultFactory({
      error: new InvalidStatusWordError("user cancelled"),
    });
    apiMock.sendCommand.mockResolvedValueOnce(registerError);

    const result = await new SendRegisterLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
    expect(result).toBe(registerError);
  });

  it("propagates GetAddress errors", async () => {
    const addressError = CommandResultFactory({
      error: new InvalidStatusWordError("get address failed"),
    });
    apiMock.sendCommand
      .mockResolvedValueOnce(
        CommandResultFactory({ data: { hmacProofHex: HMAC_PROOF_HEX } }),
      )
      .mockResolvedValueOnce(addressError);

    const result = await new SendRegisterLedgerAccountTask(apiMock, {
      ...TASK_ARGS,
      logger: mockLogger,
    }).run();

    expect(apiMock.sendCommand.mock.calls).toHaveLength(2);
    expect(result).toBe(addressError);
  });
});
