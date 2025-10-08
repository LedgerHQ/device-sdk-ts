/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";
import {
  MAX_MESSAGE_LENGTH,
  SendSignMessageTask,
} from "@internal/app-binder/task/SendSignMessageTask";

const DERIVATION_PATH = "44'/501'/0'/0'";
const PUBKEY = new Uint8Array(32).fill(0x00);
const PUBKEY_BASE58 = DefaultBs58Encoder.encode(PUBKEY);
const MESSAGE = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);

describe("SendSignMessageTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("run()", () => {
    it("should error on empty message before any device call", async () => {
      // given
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: new Uint8Array([]),
      };

      // when
      const result = await new SendSignMessageTask(apiMock, args).run();

      // then
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
      expect((result as any).error).toEqual(
        new InvalidStatusWordError("Message cannot be empty"),
      );
    });

    it("should return error if GET_PUBKEY fails", async () => {
      // given
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("pubkey error"),
        }),
      );
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: MESSAGE,
      };

      // when
      const result = await new SendSignMessageTask(apiMock, args).run();

      // then
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect((result as any).error).toEqual(
        new InvalidStatusWordError("Error getting public key from device"),
      );
    });

    it("should return error if SignOffChainMessageCommand fails", async () => {
      // given
      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
        .mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("no signature returned"),
          }),
        );
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: MESSAGE,
      };

      // when
      const result = await new SendSignMessageTask(apiMock, args).run();

      // then
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect((result as any).error).toEqual(
        new InvalidStatusWordError("no signature returned"),
      );
    });

    it("should return success when signing succeeds", async () => {
      // given
      const mockSig = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);
      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
        .mockResolvedValueOnce(CommandResultFactory({ data: mockSig }));
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: MESSAGE,
      };

      // when
      const result = await new SendSignMessageTask(apiMock, args).run();

      // then
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect((result as any).data).toEqual(mockSig);
    });

    it("should reject invalid derivation path", async () => {
      const args = {
        derivationPath: "not/a/path",
        sendingData: MESSAGE,
      };
      await expect(
        new SendSignMessageTask(apiMock, args).run(),
      ).rejects.toThrow();
    });

    it("should correctly build APDU command lengths", () => {
      // given
      const task: any = new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: MESSAGE,
      });

      // when
      const fullMsg = task._buildFullMessage(MESSAGE, PUBKEY);
      const paths = [44 | 0x80000000, 501 | 0x80000000, 0 | 0x80000000, 0];
      const apdu = task._buildApduCommand(fullMsg, paths);
      const expectedLen = 1 + 1 + paths.length * 4 + fullMsg.length;

      // then
      expect(apdu.length).toBe(expectedLen);
    });

    it("should handle maximum allowed message length", async () => {
      // given
      const headerAPDU = 1 + 1 + 4 * 4;
      const fullMsgHeader = 1 + 15 + 1 + 32 + 1 + 1 + 32 + 2;
      const maxBody = 255 - headerAPDU - fullMsgHeader;
      const bigMsg = new Uint8Array(maxBody).fill(0x01);
      const mockSig = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);
      apiMock.sendCommand
        .mockResolvedValueOnce(CommandResultFactory({ data: PUBKEY_BASE58 }))
        .mockResolvedValueOnce(CommandResultFactory({ data: mockSig }));

      // when
      const result = await new SendSignMessageTask(apiMock, {
        derivationPath: DERIVATION_PATH,
        sendingData: bigMsg,
      }).run();

      // then
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect((result as any).data).toEqual(mockSig);
    });

    it("should error on message exceeding 16-bit length (65535)", async () => {
      // given
      const tooBig = new Uint8Array(MAX_MESSAGE_LENGTH + 1).fill(0xaa);
      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: tooBig,
      };

      // when
      const result = await new SendSignMessageTask(apiMock, args).run();

      // then
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(0);
      expect((result as any).error).toEqual(
        new InvalidStatusWordError(
          `Message too long: ${tooBig.length} bytes (max is 65535)`,
        ),
      );
    });
  });
});
