import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Action, Transfer } from "@near-js/transactions";
import { Just } from "purify-ts";

import { SignDelegateCommand } from "@internal/app-binder/command/SignDelegateCommand";
import { SignDelegateTask } from "@internal/app-binder/task/SignDelegateTask";

const EXPECTED_APDU = Uint8Array.from([
  0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01, 0x8d, 0x80, 0x00, 0x00, 0x00, 0x80,
  0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x62, 0x6f,
  0x62, 0x2e, 0x6e, 0x65, 0x61, 0x72, 0x0a, 0x00, 0x00, 0x00, 0x61, 0x6c, 0x69,
  0x63, 0x65, 0x2e, 0x6e, 0x65, 0x61, 0x72, 0x01, 0x00, 0x00, 0x00, 0x03, 0x00,
  0x00, 0x00, 0x00, 0x48, 0x01, 0x14, 0x16, 0x95, 0x45, 0x08, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x60, 0x4c, 0xf6, 0xca, 0x74, 0x00, 0xc4, 0xf5, 0x94, 0x1e, 0x81, 0xe0, 0x71,
  0xc2, 0xfd, 0x1d, 0xae, 0x2e, 0x71, 0xfd, 0x3d, 0x85, 0x9d, 0x46, 0x24, 0x84,
  0x39, 0x1d, 0x9a, 0x90, 0xbf, 0x21, 0x92, 0x11, 0xdc, 0xbb, 0x32, 0x0f,
]);
const SIGNATURE_DATA = [0x21, 0x42];

describe("SignDelegateTask", () => {
  describe("run", () => {
    afterEach(() => {
      jest.resetAllMocks();
      jest.clearAllMocks();
    });
    it("should return an error if invalid public key", async () => {
      // given
      const api = {
        sendCommand: jest.fn(Promise.resolve),
      } as unknown as InternalApi;
      // when
      const publicKey = "bad-key";
      const task = new SignDelegateTask(api, {
        nonce: BigInt(0),
        actions: [],
        maxBlockHeight: BigInt(42 * 1e23),
        receiverId:
          "dc7e34eecec3096a4a661e10932834f801149c49dba9b93322f6d9de18047f9c",
        senderId:
          "c4f5941e81e071c2fd1dae2e71fd3d859d462484391d9a90bf219211dcbb320f",
        derivationPath: "44'/397'/0'/0'/1",
      });
      // then
      const result = await task.run(publicKey);
      // expect
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("Invalid public key"),
        }),
      );
    });
    it("should sign a valid delegate action", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            CommandResultFactory({
              data: Just(Uint8Array.from(SIGNATURE_DATA)),
            }),
          ),
        ),
      } as unknown as InternalApi;
      const receiverId = "alice.near";
      const senderId = "bob.near";
      const pubKey = "ed25519:EFr6nRvgKKeteKoEH7hudt8UHYiu94Liq2yMM7x2AU9U";
      const derivationPath = "44'/397'/0'/0'/1";
      const maxBlockHeight = BigInt(42 * 1e23);
      const deposit = BigInt(100 * 1e23);
      const nonce = BigInt(0);
      // when
      const result = await new SignDelegateTask(api, {
        nonce,
        actions: [new Action({ transfer: new Transfer({ deposit }) })],
        maxBlockHeight,
        receiverId,
        senderId,
        derivationPath,
      }).run(pubKey);
      // then
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignDelegateCommand({
          data: EXPECTED_APDU,
          isLastChunk: true,
        }),
      );
      expect(isSuccessCommandResult(result)).toBe(true);
    });
  });
});
