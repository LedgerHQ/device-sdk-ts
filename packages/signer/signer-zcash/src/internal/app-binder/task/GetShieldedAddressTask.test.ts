import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { GetShieldedAddressTask } from "./GetShieldedAddressTask";

const EXPECTED_ADDRESS =
  "u17qxnge3fpth2w43cfvz3lezxkevzmh5lpl5j4vlkfclpxdz9rx2fmml98wmwq3268yld6exrhyg29k2xhrnt4rldxva96qe8uwf7qc9";

const okResponse = () =>
  CommandResultFactory({ data: { address: EXPECTED_ADDRESS } });

describe("GetShieldedAddressTask", () => {
  const defaultArgs = {
    derivationPath: "44'/133'/0'/0/0",
    checkOnDevice: false,
  };

  it("should return the address on success", async () => {
    const sendCommand = vi.fn().mockResolvedValue(okResponse());
    const api = { sendCommand } as unknown as InternalApi;

    const result = await new GetShieldedAddressTask(api, defaultArgs).run();

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data.address).toBe(EXPECTED_ADDRESS);
    }
  });

  it("should derive orchard path 32'/coin/account from transparent path", async () => {
    const sendCommand = vi.fn().mockResolvedValue(okResponse());
    const api = { sendCommand } as unknown as InternalApi;

    await new GetShieldedAddressTask(api, defaultArgs).run();

    const command = sendCommand.mock.calls[0]![0];
    const apduData = command.getApdu().getRawApdu().slice(5);
    // first path length byte = 3 (orchard: 32'/133'/0')
    expect(apduData[0]).toBe(3);
    // first element of orchard path = 32' = 0x80000020
    const view = new DataView(apduData.buffer, apduData.byteOffset);
    expect(view.getUint32(1, false)).toBe(0x80000020);
  });

  it("should forward command error", async () => {
    const sendCommand = vi
      .fn()
      .mockResolvedValue(
        CommandResultFactory({
          error: new InvalidStatusWordError("device error"),
        }),
      );
    const api = { sendCommand } as unknown as InternalApi;

    const result = await new GetShieldedAddressTask(api, defaultArgs).run();

    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("should return error when derivation path does not have exactly 5 levels", async () => {
    const sendCommand = vi.fn();
    const api = { sendCommand } as unknown as InternalApi;

    const result = await new GetShieldedAddressTask(api, {
      derivationPath: "44'/133'/0'",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it("should strip m/ prefix and derive correct orchard path", async () => {
    const sendCommand = vi.fn().mockResolvedValue(okResponse());
    const api = { sendCommand } as unknown as InternalApi;

    const result = await new GetShieldedAddressTask(api, {
      derivationPath: "m/44'/133'/0'/0/0",
    }).run();

    expect(isSuccessCommandResult(result)).toBe(true);

    const command = sendCommand.mock.calls[0]![0];
    const apduData = command.getApdu().getRawApdu().slice(5);
    const view = new DataView(apduData.buffer, apduData.byteOffset);
    // first orchard path element must be 32' = 0x80000020, not 44' = 0x8000002c
    expect(view.getUint32(1, false)).toBe(0x80000020);
  });
});
