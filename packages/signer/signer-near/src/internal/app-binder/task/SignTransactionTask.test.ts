import {
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { PublicKey } from "@near-js/crypto";
import { Action, Stake } from "@near-js/transactions";
import { Just, Nothing } from "purify-ts";

import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";

const EXPECTED_TX_APDU = Uint8Array.from([
  0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x01, 0x8d, 0x80, 0x00, 0x00, 0x00, 0x80,
  0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00, 0x00, 0x62, 0x6f,
  0x62, 0x2e, 0x6e, 0x65, 0x61, 0x72, 0x00, 0xc4, 0xf5, 0x94, 0x1e, 0x81, 0xe0,
  0x71, 0xc2, 0xfd, 0x1d, 0xae, 0x2e, 0x71, 0xfd, 0x3d, 0x85, 0x9d, 0x46, 0x24,
  0x84, 0x39, 0x1d, 0x9a, 0x90, 0xbf, 0x21, 0x92, 0x11, 0xdc, 0xbb, 0x32, 0x0f,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x61,
  0x6c, 0x69, 0x63, 0x65, 0x2e, 0x6e, 0x65, 0x61, 0x72, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x60, 0x4c, 0xf6,
  0xca, 0x74, 0x62, 0x79, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc4, 0xf5,
  0x94, 0x1e, 0x81, 0xe0, 0x71, 0xc2, 0xfd, 0x1d, 0xae, 0x2e, 0x71, 0xfd, 0x3d,
  0x85, 0x9d, 0x46, 0x24, 0x84, 0x39, 0x1d, 0x9a, 0x90, 0xbf, 0x21, 0x92, 0x11,
  0xdc, 0xbb, 0x32, 0x0f,
]);

const SIGNATURE_DATA = Uint8Array.from([0x21, 0x42]);

describe("SignTransactionTask", () => {
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
      const task = new SignTransactionTask(api, {
        nonce: BigInt(0),
        actions: [
          new Action({
            stake: new Stake({
              stake: BigInt(42 * 1e23),
              publicKey: PublicKey.fromString(
                "ed25519:EFr6nRvgKKeteKoEH7hudt8UHYiu94Liq2yMM7x2AU9U",
              ),
            }),
          }),
        ],
        blockHash: Uint8Array.from(new Array(32).fill(0)),
        receiverId: "alice.near",
        signerId: "bob.near",
        derivationPath: "44'/397'/0'/0'/1",
      });
      // then
      const result = await task.run(publicKey);
      // expect
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Invalid public key"),
        }),
      );
    });
    it("should sign a valid transaction", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            CommandResultFactory({
              data: Just(SIGNATURE_DATA),
            }),
          ),
        ),
      } as unknown as InternalApi;
      const pubKey = "ed25519:EFr6nRvgKKeteKoEH7hudt8UHYiu94Liq2yMM7x2AU9U";
      const task = new SignTransactionTask(api, {
        nonce: BigInt(0),
        actions: [
          new Action({
            stake: new Stake({
              stake: BigInt(42 * 1e23),
              publicKey: PublicKey.fromString(pubKey),
            }),
          }),
        ],
        blockHash: Uint8Array.from(new Array(32).fill(0)),
        receiverId: "alice.near",
        signerId: "bob.near",
        derivationPath: "44'/397'/0'/0'/1",
      });
      // when
      const result = await task.run(pubKey);
      // then
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignTransactionCommand({
          isLastChunk: true,
          data: EXPECTED_TX_APDU,
        }),
      );
      expect(result).toStrictEqual(
        CommandResultFactory({
          data: Uint8Array.from(SIGNATURE_DATA),
        }),
      );
    });
    it("should return an error if no signature provided", async () => {
      // given
      const api = {
        sendCommand: jest.fn(() =>
          Promise.resolve(
            CommandResultFactory({
              data: Nothing,
            }),
          ),
        ),
      } as unknown as InternalApi;
      const task = new SignTransactionTask(api, {
        nonce: BigInt(0),
        actions: [],
        blockHash: Uint8Array.from(new Array(32).fill(0)),
        receiverId: "",
        signerId: "",
        derivationPath: "",
      });
      const pubKey = "ed25519:EFr6nRvgKKeteKoEH7hudt8UHYiu94Liq2yMM7x2AU9U";
      // when
      const result = await task.run(pubKey);
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("no signature returned"),
        }),
      );
    });
  });
});
