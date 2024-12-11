import {
  CommandResultFactory,
  type InternalApi,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { type Maybe } from "purify-ts";

import { type NearAppErrorCodes } from "@internal/app-binder/command/NearAppCommand";
import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";

import { SignUtils } from "./SignUtils";

const ONE_CHUNK_SIZE = 32;
const CHUNK_16 = Uint8Array.from(new Array(16).keys());
const CHUNK_32 = Uint8Array.from(new Array(32).keys());
const CHUNK_128 = Uint8Array.from(new Array(128).keys());

describe("SignUtils", () => {
  describe("signInChunks", () => {
    afterEach(() => {
      jest.resetAllMocks();
      jest.clearAllMocks();
    });

    it("should send command for 1 chunk of max chunk size", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            CommandResultFactory({
              data: CHUNK_32,
            }),
          ),
        ),
      } as unknown as InternalApi;
      const utils = new SignUtils(api, ONE_CHUNK_SIZE);
      // when
      const response = await utils.signInChunks<
        Maybe<Uint8Array>,
        NearAppErrorCodes
      >(SignMessageCommand, CHUNK_32);
      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({ data: CHUNK_32, isLastChunk: true }),
      );
      expect(response).toStrictEqual(CommandResultFactory({ data: CHUNK_32 }));
    });

    it("should send command for 1 chunk smaller than max chunk size", async () => {
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            CommandResultFactory({
              data: CHUNK_128,
            }),
          ),
        ),
      } as unknown as InternalApi;
      const utils = new SignUtils(api, ONE_CHUNK_SIZE);
      // when
      const response = await utils.signInChunks<
        Maybe<Uint8Array>,
        NearAppErrorCodes
      >(SignMessageCommand, CHUNK_16);
      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({ data: CHUNK_16, isLastChunk: true }),
      );
      expect(response).toStrictEqual(CommandResultFactory({ data: CHUNK_128 }));
    });

    it("should send 4 commands for 4 chunks of max chunk size", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          CommandResultFactory({
            data: Uint8Array.from(CHUNK_32),
          }),
        ),
      } as unknown as InternalApi;
      const utils = new SignUtils(api, ONE_CHUNK_SIZE);
      // when
      const response = await utils.signInChunks<
        Maybe<Uint8Array>,
        NearAppErrorCodes
      >(SignMessageCommand, CHUNK_128);
      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(4);
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({
          data: CHUNK_128.slice(0, 32),
          isLastChunk: false,
        }),
      );
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({
          data: CHUNK_128.slice(32, 64),
          isLastChunk: false,
        }),
      );
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({
          data: CHUNK_128.slice(64, 96),
          isLastChunk: false,
        }),
      );
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({
          data: CHUNK_128.slice(96, 128),
          isLastChunk: true,
        }),
      );
      expect(response).toStrictEqual(CommandResultFactory({ data: CHUNK_32 }));
    });

    it("should return command error", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          CommandResultFactory({
            error: new UnknownDeviceExchangeError("Error"),
          }),
        ),
      } as unknown as InternalApi;
      const utils = new SignUtils(api, ONE_CHUNK_SIZE);
      // when
      const response = await utils.signInChunks<
        Maybe<Uint8Array>,
        NearAppErrorCodes
      >(SignMessageCommand, CHUNK_128);
      // then
      expect(response).toStrictEqual(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Error"),
        }),
      );
    });
  });
});
