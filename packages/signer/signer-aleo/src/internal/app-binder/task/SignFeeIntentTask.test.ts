import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/task/__test-utils__/makeInternalApi";
import { SignFeeIntentTask } from "@internal/app-binder/task/SignFeeIntentTask";

describe("SignFeeIntentTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signature = { tlvSignature: "mock_signature" };
  const resultOk = CommandResultFactory({ data: signature });
  const resultEmpty = CommandResultFactory({ data: { tlvSignature: "" } });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should send the fee intent in a single command", async () => {
    // GIVEN
    const feeIntent = new Uint8Array([0x05, 0x06, 0x07, 0x08]);

    // Calculate expected payload: 2 (intent len) + intent
    const builder = new ByteArrayBuilder(2 + feeIntent.length);
    builder.add16BitUIntToData(feeIntent.length);
    builder.addBufferToData(feeIntent);
    const expectedPayload = builder.build();

    apiMock.sendCommand.mockResolvedValueOnce(resultOk);

    const task = new SignFeeIntentTask(apiMock, {
      feeIntent,
    });

    // WHEN
    const result = await task.run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        args: {
          chunkedData: expectedPayload,
          isFirst: true,
        },
      }),
    );

    if (isSuccessCommandResult(result)) {
      expect(result.data).toEqual(signature);
    } else {
      assert.fail("Expected success");
    }
  });

  it("should send the fee intent in multiple chunks", async () => {
    // GIVEN
    // Create a large fee intent so total payload > APDU_MAX_PAYLOAD (255)
    const feeIntent = new Uint8Array(300).fill(0x24);

    const builder = new ByteArrayBuilder(2 + feeIntent.length);
    builder.add16BitUIntToData(feeIntent.length);
    builder.addBufferToData(feeIntent);
    const fullPayload = builder.build();

    const chunk1 = fullPayload.slice(0, APDU_MAX_PAYLOAD);
    const chunk2 = fullPayload.slice(APDU_MAX_PAYLOAD);

    apiMock.sendCommand
      .mockResolvedValueOnce(resultEmpty)
      .mockResolvedValueOnce(resultOk);

    const task = new SignFeeIntentTask(apiMock, {
      feeIntent,
    });

    // WHEN
    const result = await task.run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);

    // First chunk
    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        args: {
          chunkedData: chunk1,
          isFirst: true,
        },
      }),
    );

    // Second chunk
    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        args: {
          chunkedData: chunk2,
          isFirst: false,
        },
      }),
    );

    if (isSuccessCommandResult(result)) {
      expect(result.data).toEqual(signature);
    } else {
      assert.fail("Expected success");
    }
  });
});
