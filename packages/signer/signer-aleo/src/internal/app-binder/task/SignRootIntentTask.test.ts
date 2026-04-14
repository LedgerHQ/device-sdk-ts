import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { SignRootIntentTask } from "@internal/app-binder/task/SignRootIntentTask";

import { makeDeviceActionInternalApiMock } from "./__test-utils__/makeInternalApi";

const DERIVATION_PATH = "44'/683'/0'/0'/0'";

describe("SignRootIntentTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signature = { tlvSignature: "mock_signature" };
  const resultOk = CommandResultFactory({ data: signature });
  const resultEmpty = CommandResultFactory({ data: { tlvSignature: "" } });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should send the root intent in a single command", async () => {
    // GIVEN
    const rootIntent = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const paths = DerivationPathUtils.splitPath(DERIVATION_PATH);

    // Calculate expected payload: 1 (path len) + path (4 * len) + 2 (intent len) + intent
    const builder = new ByteArrayBuilder(
      1 + paths.length * 4 + 2 + rootIntent.length,
    );
    builder.add8BitUIntToData(paths.length);
    paths.forEach((p) => builder.add32BitUIntToData(p));
    builder.add16BitUIntToData(rootIntent.length);
    builder.addBufferToData(rootIntent);
    const expectedPayload = builder.build();

    apiMock.sendCommand.mockResolvedValueOnce(resultOk);

    const task = new SignRootIntentTask(apiMock, {
      derivationPath: DERIVATION_PATH,
      rootIntent,
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

  it("should send the root intent in multiple chunks", async () => {
    // GIVEN
    // Create a large root intent so total payload > APDU_MAX_PAYLOAD (255)
    const rootIntent = new Uint8Array(300).fill(0x42);
    const paths = DerivationPathUtils.splitPath(DERIVATION_PATH);

    const builder = new ByteArrayBuilder(
      1 + paths.length * 4 + 2 + rootIntent.length,
    );
    builder.add8BitUIntToData(paths.length);
    paths.forEach((p) => builder.add32BitUIntToData(p));
    builder.add16BitUIntToData(rootIntent.length);
    builder.addBufferToData(rootIntent);
    const fullPayload = builder.build();

    const chunk1 = fullPayload.slice(0, APDU_MAX_PAYLOAD);
    const chunk2 = fullPayload.slice(APDU_MAX_PAYLOAD);

    apiMock.sendCommand
      .mockResolvedValueOnce(resultEmpty)
      .mockResolvedValueOnce(resultOk);

    const task = new SignRootIntentTask(apiMock, {
      derivationPath: DERIVATION_PATH,
      rootIntent,
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
