import {
  type CommandResult,
  CommandResultStatus,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { ClientCommandCodes } from "@internal/app-binder/command/utils/constants";
import { DefaultDataStoreService } from "@internal/data-store/service/DefaultDataStoreService";

import { SendSignMessageTask } from "./SignMessageTask";

describe("SendSignMessageTask", () => {
  let mockApi: jest.Mocked<InternalApi>;

  beforeEach(() => {
    mockApi = {
      sendCommand: jest.fn(),
    } as unknown as jest.Mocked<InternalApi>;
  });

  it("should successfully sign a small message and return the preimage", async () => {
    //given
    const args = {
      derivationPath: "44'/0'/0'/0/0",
      message: "Test message for signing",
    };

    const sendSignMessageTask = new SendSignMessageTask(mockApi, args);

    const merkleRoot = new Uint8Array(32).fill(0xaa);
    jest
      .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
      .mockReturnValue(merkleRoot);

    const YIELD_CMD_CODE = ClientCommandCodes.YIELD;
    const yieldPayload = new Uint8Array([0xde, 0xf1, 0xde, 0xf1]);
    const yieldResponse = new Uint8Array([YIELD_CMD_CODE, ...yieldPayload]);

    mockApi.sendCommand.mockResolvedValue(
      yieldResponse as unknown as
        | CommandResult<unknown, unknown>
        | Promise<CommandResult<unknown, unknown>>,
    );

    //when
    const result = await sendSignMessageTask.run();

    //then
    expect(result.status).toBe("SUCCESS");
    if (result.status === CommandResultStatus.Success) {
      expect(result.data).toEqual(yieldPayload);
    } else {
      throw new Error(
        `Expected success but got error: ${result.error?.toString()}`,
      );
    }
  });

  it("should successfully sign a large message and return the preimage", async () => {
    //given
    const args = {
      derivationPath: "44'/0'/0'/0/0",
      message: "a".repeat(512),
    };

    const sendSignMessageTask = new SendSignMessageTask(mockApi, args);

    const merkleRoot = new Uint8Array(32).fill(0xaa);

    jest
      .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
      .mockImplementation((_, chunks) => {
        expect(chunks.length).toBe(8);
        return merkleRoot;
      });

    const YIELD_CMD_CODE = ClientCommandCodes.YIELD;
    const yieldPayload = new Uint8Array([0xde, 0xf1, 0xde, 0xf1]);
    const yieldResponse = new Uint8Array([YIELD_CMD_CODE, ...yieldPayload]);

    mockApi.sendCommand.mockResolvedValue(
      yieldResponse as unknown as
        | CommandResult<unknown, unknown>
        | Promise<CommandResult<unknown, unknown>>,
    );

    //when
    const result = await sendSignMessageTask.run();

    //then
    expect(result.status).toBe("SUCCESS");
    if (result.status === CommandResultStatus.Success) {
      expect(result.data).toEqual(yieldPayload);
    } else {
      throw new Error(
        `Expected success but got error: ${result.error?.toString()}`,
      );
    }
  });

  it("should correctly process a message that fits in exactly one chunk", async () => {
    //given
    const args = {
      derivationPath: "44'/0'/0'/0/0",
      message: "a".repeat(64),
    };

    const sendSignMessageTask = new SendSignMessageTask(mockApi, args);

    const merkleRoot = new Uint8Array(32).fill(0x01);

    jest
      .spyOn(DefaultDataStoreService.prototype, "merklizeChunks")
      .mockImplementation((_, chunks) => {
        expect(chunks.length).toBe(1);
        return merkleRoot;
      });

    const YIELD_CMD_CODE = ClientCommandCodes.YIELD;
    const yieldPayload = new Uint8Array([0xde, 0xf1, 0xde, 0xf1]);
    const yieldResponse = new Uint8Array([YIELD_CMD_CODE, ...yieldPayload]);

    mockApi.sendCommand.mockResolvedValue(
      yieldResponse as unknown as
        | CommandResult<unknown, unknown>
        | Promise<CommandResult<unknown, unknown>>,
    );

    //when
    const result = await sendSignMessageTask.run();

    //then
    expect(result.status).toBe("SUCCESS");
    if (result.status === CommandResultStatus.Success) {
      expect(result.data).toEqual(yieldPayload);
    } else {
      throw new Error(
        `Expected success but got error: ${result.error?.toString()}`,
      );
    }
  });
});
