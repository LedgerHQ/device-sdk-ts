import {
  ApduResponse,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type LegacyTransaction } from "@api/model/CreateTransactionArg";
import { LITECOIN_PROFILE } from "@api/profiles/litecoinProfile";
import { LegacyGetTrustedInputCommand } from "@internal/app-binder/command/GetTrustedInputCommand";
import { BtcLegacyAppCommandError } from "@internal/app-binder/command/utils/btcLegacyApplicationErrors";
import { type TrustedInputSerializer } from "@internal/app-binder/task/format/TrustedInputSerializer";

import { GetTrustedInputTask } from "./GetTrustedInputTask";

const success = (data: Uint8Array) =>
  CommandResultFactory({
    data: new ApduResponse({ statusCode: Uint8Array.of(0x90, 0x00), data }),
  });

describe("GetTrustedInputTask", () => {
  const sendCommand = vi.fn();
  const api = { sendCommand } as unknown as InternalApi;
  const serialize = vi.fn();
  const serializer: TrustedInputSerializer = { serialize };
  const transaction = {} as LegacyTransaction;
  const chunks = [Uint8Array.of(0x01), Uint8Array.of(0x02)];

  beforeEach(() => {
    sendCommand.mockReset();
    serialize.mockReset();
  });

  it("should stream the serialized transaction and return the last answer", async () => {
    serialize.mockReturnValue(chunks);
    sendCommand
      .mockResolvedValueOnce(success(new Uint8Array()))
      .mockResolvedValueOnce(success(Uint8Array.of(0x32, 0x00)));

    const result = await new GetTrustedInputTask(
      LITECOIN_PROFILE,
      serializer,
    ).run(api, { transaction, indexLookup: 1 });

    expect(result).toStrictEqual({
      status: "SUCCESS",
      data: Uint8Array.of(0x32, 0x00),
    });
    expect(serialize).toHaveBeenCalledWith(transaction);
    expect(sendCommand).toHaveBeenNthCalledWith(
      1,
      new LegacyGetTrustedInputCommand(
        { data: chunks[0]!, indexLookup: 1 },
        LITECOIN_PROFILE.errors,
      ),
    );
    expect(sendCommand).toHaveBeenNthCalledWith(
      2,
      new LegacyGetTrustedInputCommand(
        { data: chunks[1]!, indexLookup: undefined },
        LITECOIN_PROFILE.errors,
      ),
    );
  });

  it("should stop at the first error", async () => {
    serialize.mockReturnValue(chunks);
    const error = new BtcLegacyAppCommandError({
      message: "IncorrectDataError",
      errorCode: "6a80",
    });
    sendCommand.mockResolvedValueOnce(CommandResultFactory({ error }));

    const result = await new GetTrustedInputTask(
      LITECOIN_PROFILE,
      serializer,
    ).run(api, { transaction, indexLookup: 0 });

    expect(result).toStrictEqual({ status: "ERROR", error });
    expect(sendCommand).toHaveBeenCalledTimes(1);
  });

  it("should return the serializer's error", async () => {
    serialize.mockImplementation(() => {
      throw new Error("Missing field");
    });

    const result = await new GetTrustedInputTask(
      LITECOIN_PROFILE,
      serializer,
    ).run(api, { transaction, indexLookup: 0 });

    expect(result).toStrictEqual({
      status: "ERROR",
      error: new InvalidStatusWordError("Missing field"),
    });
    expect(sendCommand).not.toHaveBeenCalled();
  });
});
