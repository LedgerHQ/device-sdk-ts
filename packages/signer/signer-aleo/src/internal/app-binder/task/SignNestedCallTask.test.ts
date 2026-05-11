import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/task/__test-utils__/makeInternalApi";
import { SignNestedCallTask } from "@internal/app-binder/task/SignNestedCallTask";

describe("SignNestedCallTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signature = { tlvSignature: "mock_signature" };
  const resultOk = CommandResultFactory({ data: signature });
  const resultEmpty = CommandResultFactory({ data: { tlvSignature: "" } });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should send the nested call request in a single command", async () => {
    // GIVEN
    const nestedCallRequest = new Uint8Array([0x05, 0x06, 0x07, 0x08]);

    const builder = new ByteArrayBuilder(2 + nestedCallRequest.length);
    builder.add16BitUIntToData(nestedCallRequest.length);
    builder.addBufferToData(nestedCallRequest);
    const expectedPayload = builder.build();

    apiMock.sendCommand.mockResolvedValueOnce(resultOk);

    const task = new SignNestedCallTask(apiMock, {
      nestedCallRequest,
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

  it("should send the nested call request in multiple chunks", async () => {
    // GIVEN
    const nestedCallRequest = new Uint8Array(300).fill(0x24);

    const builder = new ByteArrayBuilder(2 + nestedCallRequest.length);
    builder.add16BitUIntToData(nestedCallRequest.length);
    builder.addBufferToData(nestedCallRequest);
    const fullPayload = builder.build();

    const chunk1 = fullPayload.slice(0, APDU_MAX_PAYLOAD);
    const chunk2 = fullPayload.slice(APDU_MAX_PAYLOAD);

    apiMock.sendCommand
      .mockResolvedValueOnce(resultEmpty)
      .mockResolvedValueOnce(resultOk);

    const task = new SignNestedCallTask(apiMock, {
      nestedCallRequest,
    });

    // WHEN
    const result = await task.run();

    // THEN
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);

    expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        args: {
          chunkedData: chunk1,
          isFirst: true,
        },
      }),
    );

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
