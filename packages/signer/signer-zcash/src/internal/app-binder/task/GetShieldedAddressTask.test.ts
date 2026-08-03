import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { GetShieldedAddressTask } from "./GetShieldedAddressTask";

// firmware test vector: test_get_orchard_uaddress_no_confirm in app-zcash/tests/standalone/test_pubkey_cmd.py
const EXPECTED_ADDRESS =
  "u1u2h4ce7e2cn3z4nzur95muq2dl4da9x8h8kdp2l80gm9nl9raj8zzpx79ycjnfvar4v5exea5pqr5y9qsnlp0cdunwf9yjjx5c4q7ar9";

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
    const sendCommand = vi.fn().mockResolvedValue(
      CommandResultFactory({
        error: new InvalidStatusWordError("device error"),
      }),
    );
    const api = { sendCommand } as unknown as InternalApi;

    const result = await new GetShieldedAddressTask(api, defaultArgs).run();

    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it.each([
    {
      desc: "derivation path does not have exactly 5 levels",
      path: "44'/133'/0'",
    },
    { desc: "a path component is non-numeric", path: "44'/foo/0'/0/0" },
    { desc: "coin type component is empty", path: "44'//0'/0/0" },
    { desc: "coin type is not hardened", path: "44'/133/0'/0/0" },
    { desc: "account is not hardened", path: "44'/133'/0/0/0" },
    { desc: "purpose is not 44'", path: "0'/133'/0'/0/0" },
    { desc: "purpose is not hardened", path: "44/133'/0'/0/0" },
    { desc: "change is not 0", path: "44'/133'/0'/1/0" },
  ])("should return error when $desc", async ({ path }) => {
    const sendCommand = vi.fn();
    const api = { sendCommand } as unknown as InternalApi;

    const result = await new GetShieldedAddressTask(api, {
      derivationPath: path,
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
