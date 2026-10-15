import {
  CommandResultFactory,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import { LegacyGetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { BtcLegacyAppCommandError } from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";

import { GetExtendedPublicKeyTask } from "./GetExtendedPublicKeyTask";

// What the Litecoin app answers for the Speculos default seed at 84'/2' and
// 84'/2'/0'. Fed to hw-app-btc's BtcOld.getWalletXpub with Ledger Wallet's
// Litecoin xpubVersion, these answers give EXPECTED_XPUB, which an off-device
// BIP32 derivation of the same seed gives too.
const PARENT = {
  publicKey: hexaStringToBuffer(
    "0419d47ce31cd2be874b9b48e83450363432ba8abc9d87f1e3230360b112d8d49480abe038efb2b8134e6c7fe29f34387e0f58778782e34e5aeab66e44b3d437e7",
  )!,
  address: "LTLpvs8JfnVuLPeSW3ytwSb5g5uMWeRZtn",
  chainCode: hexaStringToBuffer(
    "a0bdbf03de201a0e7ec5c9566f6cebf8527ec7c339bde84f518f7c9dacf939dc",
  )!,
};
const ACCOUNT = {
  publicKey: hexaStringToBuffer(
    "0447ab10aeb2dc757e67caff3344dcd85a040083d989bfa4f65c51fe40d73c667df1d3c968cc15c16b660d0077a772d6df8b2cfdf3e25f06740daf2cf8edb7cf3f",
  )!,
  address: "LbNBvLZgJuMVLaijbc9jwJEWzwGQqMxYVY",
  chainCode: hexaStringToBuffer(
    "3c2c8dd345b788b7627d756f053d1367f9d3a7ee5a1b7433098951915a207876",
  )!,
};
const EXPECTED_XPUB =
  "Ltub2YjqxJZ2tFm4yqCiWtdvp6AHH2zSNCqD8LyoLWL4AJhBc8NTHTTCCdCiBEnmjHvQ67LtUd63FxqXGgG8PPJrNC65fpBHqSKXZpf85J452uC";

describe("GetExtendedPublicKeyTask", () => {
  const sendCommand = vi.fn();
  const api = { sendCommand } as unknown as InternalApi;

  beforeEach(() => {
    sendCommand.mockReset();
  });

  it("should build the xpub from the parent and account keys", async () => {
    sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: PARENT }))
      .mockResolvedValueOnce(CommandResultFactory({ data: ACCOUNT }));

    const result = await new GetExtendedPublicKeyTask(api, {
      derivationPath: "84'/2'/0'",
      profile: LITECOIN_PROFILE,
    }).run();

    expect(result).toStrictEqual({
      status: "SUCCESS",
      data: { extendedPublicKey: EXPECTED_XPUB },
    });
    expect(sendCommand).toHaveBeenNthCalledWith(
      1,
      new LegacyGetAddressCommand(
        { derivationPath: "84'/2'" },
        LITECOIN_PROFILE.errors,
      ),
    );
    expect(sendCommand).toHaveBeenNthCalledWith(
      2,
      new LegacyGetAddressCommand(
        { derivationPath: "84'/2'/0'" },
        LITECOIN_PROFILE.errors,
      ),
    );
  });

  it("should return the error of the parent key", async () => {
    const error = new BtcLegacyAppCommandError({
      message: "UserRejectedError",
      errorCode: "6985",
    });
    sendCommand.mockResolvedValueOnce(CommandResultFactory({ error }));

    const result = await new GetExtendedPublicKeyTask(api, {
      derivationPath: "84'/2'/0'",
      profile: LITECOIN_PROFILE,
    }).run();

    expect(result).toStrictEqual({ status: "ERROR", error });
    expect(sendCommand).toHaveBeenCalledTimes(1);
  });

  it("should return the error of the account key", async () => {
    const error = new BtcLegacyAppCommandError({
      message: "IncorrectDataError",
      errorCode: "6a80",
    });
    sendCommand
      .mockResolvedValueOnce(CommandResultFactory({ data: PARENT }))
      .mockResolvedValueOnce(CommandResultFactory({ error }));

    const result = await new GetExtendedPublicKeyTask(api, {
      derivationPath: "84'/2'/0'",
      profile: LITECOIN_PROFILE,
    }).run();

    expect(result).toStrictEqual({ status: "ERROR", error });
  });

  it("should reject a path without a parent level", async () => {
    const result = await new GetExtendedPublicKeyTask(api, {
      derivationPath: "84'",
      profile: LITECOIN_PROFILE,
    }).run();

    expect(result).toStrictEqual({
      status: "ERROR",
      error: new InvalidStatusWordError(
        "The derivation path needs at least two levels",
      ),
    });
    expect(sendCommand).not.toHaveBeenCalled();
  });
});
