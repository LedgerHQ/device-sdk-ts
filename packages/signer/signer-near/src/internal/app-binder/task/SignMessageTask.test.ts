import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";

import { SignMessageCommand } from "@internal/app-binder/command/SignMessageCommand";
import { SignMessageTask } from "@internal/app-binder/task/SignMessageTask";

const NONCE = crypto.getRandomValues(new Uint8Array(32));

const DERIVATION_PATH = Uint8Array.from([
  0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01, 0x8d, 0x80, 0x00, 0x00, 0x00, 0x80,
  0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x01,
]);

const HELLO_WORLD = Uint8Array.from([
  0x0b, 0x00, 0x00, 0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72,
  0x6c, 0x64,
]);

const RECIPIENT = Uint8Array.from([
  0x0a, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x69, 0x63, 0x65, 0x2e, 0x6e, 0x65, 0x61,
  0x72,
]);

const CALLBACK_URL = Uint8Array.from([
  0x01, 0x12, 0x00, 0x00, 0x00, 0x6d, 0x79, 0x61, 0x70, 0x70, 0x2e, 0x63, 0x6f,
  0x6d, 0x2f, 0x63, 0x61, 0x6c, 0x6c, 0x62, 0x61, 0x63, 0x6b,
]);

const EXPECTED_HELLO_WORLD = Uint8Array.from([
  ...DERIVATION_PATH,
  ...HELLO_WORLD,
  ...NONCE,
  ...RECIPIENT,
  ...CALLBACK_URL,
]);

const EXPECTED_HELLO_WORLD_WITHOUT_CALLBACK = Uint8Array.from([
  ...DERIVATION_PATH,
  ...HELLO_WORLD,
  ...NONCE,
  ...RECIPIENT,
  ...[0x00],
]);

const EXPECTED_HELLO_WORLD_WITH_CALLBACK = Uint8Array.from([
  ...DERIVATION_PATH,
  ...HELLO_WORLD,
  ...NONCE,
  ...RECIPIENT,
  ...CALLBACK_URL,
]);

describe("SignMessageTask", () => {
  describe("run", () => {
    afterEach(() => {
      jest.resetAllMocks();
      jest.clearAllMocks();
    });
    it("should sign a valid buffer with given nonce", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            Promise.resolve(
              CommandResultFactory({
                data: Just(Uint8Array.from([0x42, 0x21])),
              }),
            ),
          ),
        ),
      } as unknown as InternalApi;
      const task = new SignMessageTask(api, {
        nonce: NONCE,
        message: "Hello world",
        recipient: "alice.near",
        derivationPath: "44'/397'/0'/0'/1",
        callbackUrl: "myapp.com/callback",
      });
      // when
      const result = await task.run();
      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({
          data: EXPECTED_HELLO_WORLD,
          isLastChunk: true,
        }),
      );
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Uint8Array.from([0x42, 0x21]),
        }),
      );
    });
    it("should sign a valid buffer with callback", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            CommandResultFactory({ data: Just(Uint8Array.from([0x42, 0x21])) }),
          ),
        ),
      } as unknown as InternalApi;
      const task = new SignMessageTask(api, {
        nonce: NONCE,
        message: "Hello world",
        recipient: "alice.near",
        derivationPath: "44'/397'/0'/0'/1",
        callbackUrl: "myapp.com/callback",
      });
      // when
      const result = await task.run();
      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({
          data: EXPECTED_HELLO_WORLD_WITH_CALLBACK,
          isLastChunk: true,
        }),
      );
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Uint8Array.from([0x42, 0x21]),
        }),
      );
    });
    it("should sign a valid buffer without callback", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            CommandResultFactory({ data: Just(Uint8Array.from([0x42, 0x21])) }),
          ),
        ),
      } as unknown as InternalApi;
      const task = new SignMessageTask(api, {
        nonce: NONCE,
        message: "Hello world",
        recipient: "alice.near",
        derivationPath: "44'/397'/0'/0'/1",
      });
      // when
      const result = await task.run();
      // then
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignMessageCommand({
          data: EXPECTED_HELLO_WORLD_WITHOUT_CALLBACK,
          isLastChunk: true,
        }),
      );
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Uint8Array.from([0x42, 0x21]),
        }),
      );
    });
    it("should return an error if no signature", async () => {
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            CommandResultFactory({
              data: Nothing,
            }),
          ),
        ),
      } as unknown as InternalApi;
      const task = new SignMessageTask(api, {
        nonce: NONCE,
        message: "Hello world",
        recipient: "alice.near",
        derivationPath: "44'/397'/0'/0'/1",
      });
      // when
      const result = await task.run();
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("no signature returned"),
        }),
      );
    });
  });
});
