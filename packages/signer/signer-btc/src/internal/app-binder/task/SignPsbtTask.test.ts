import {
  CommandResultFactory,
  type InternalApi,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Maybe, Nothing } from "purify-ts";

import { SignPsbtCommand } from "@internal/app-binder/command/SignPsbtCommand";
import { type ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { SignPsbtTask } from "@internal/app-binder/task/SignPsbtTask";
import { type DataStore } from "@internal/data-store/model/DataStore";
import type { PsbtCommitment } from "@internal/data-store/service/DataStoreService";
import { type Psbt } from "@internal/psbt/model/Psbt";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { type Wallet } from "@internal/wallet/model/Wallet";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

const SIGN_PSBT_YIELD_RESULT = Uint8Array.from([
  0x00, 0x20, 0xf1, 0xe8, 0x42, 0x44, 0x7f, 0xae, 0x7b, 0x1c, 0x6e, 0xb7, 0xa8,
  0xa7, 0x85, 0xf7, 0x76, 0xfa, 0x19, 0xa9, 0x3a, 0xb9, 0x6c, 0xc1, 0xee, 0xee,
  0xe9, 0x47, 0xc1, 0x71, 0x13, 0x38, 0x5f, 0x5f, 0x12, 0x4d, 0x63, 0x5c, 0xf2,
  0x52, 0xae, 0x26, 0xa6, 0x7b, 0xe2, 0x77, 0x71, 0x2e, 0xad, 0x07, 0xb4, 0x48,
  0x96, 0xdf, 0xb0, 0x16, 0xfc, 0x9d, 0x03, 0xa3, 0xe9, 0x22, 0xbd, 0x9a, 0x01,
  0x66, 0x3c, 0x59, 0x59, 0x41, 0x13, 0xe5, 0x71, 0x00, 0x06, 0x3d, 0x9d, 0xcc,
  0xd7, 0x8f, 0xb3, 0x93, 0x82, 0xdb, 0xf8, 0x0a, 0x8f, 0x11, 0x50, 0xfd, 0x59,
  0xd9, 0xfe, 0xb7, 0x9e, 0x25, 0x3b, 0xd2,
]);

describe("SignPsbtTask", () => {
  describe("run", () => {
    it("should return signatures", async () => {
      // given
      const api = {
        sendCommand: jest.fn(),
      } as unknown as InternalApi;
      const psbt = {
        getGlobalValue: () => Maybe.of(Uint8Array.from([0x03])),
      } as unknown as Psbt;
      const wallet = {
        hmac: Uint8Array.from([0x04]),
      } as Wallet;
      const psbtCommitment = {
        globalCommitment: Uint8Array.from([0x03]),
        inputsRoot: Uint8Array.from([0x01]),
        outputsRoot: Uint8Array.from([0x02]),
      } as PsbtCommitment;
      const dataStore = {} as DataStore;
      const walletSerializer = {
        getId: jest.fn(() => Uint8Array.from([0x05])),
      } as unknown as WalletSerializer;
      const valueParser = {
        getVarint: jest.fn(() => Maybe.of(42)),
      } as unknown as ValueParser;
      const continueTaskFactory = () =>
        ({
          run: jest.fn().mockResolvedValue(
            CommandResultFactory({
              data: [],
            }),
          ),
          getYieldedResults: () => [SIGN_PSBT_YIELD_RESULT],
        }) as unknown as ContinueTask;

      // when
      const signatures = await new SignPsbtTask(
        api,
        {
          psbt,
          wallet,
          psbtCommitment,
          dataStore,
        },
        walletSerializer,
        valueParser,
        continueTaskFactory,
      ).run();
      // then
      expect(api.sendCommand).toHaveBeenCalledWith(
        new SignPsbtCommand({
          globalCommitment: Uint8Array.from([0x03]),
          inputsCount: 42,
          inputsRoot: Uint8Array.from([0x01]),
          outputsCount: 42,
          outputsRoot: Uint8Array.from([0x02]),
          walletId: Uint8Array.from([0x05]),
          walletHmac: Uint8Array.from([0x04]),
        }),
      );
      expect(signatures).toStrictEqual(
        CommandResultFactory({
          data: [
            {
              inputIndex: 0,
              pubKeyAugmented: Uint8Array.from([
                0xf1, 0xe8, 0x42, 0x44, 0x7f, 0xae, 0x7b, 0x1c, 0x6e, 0xb7,
                0xa8, 0xa7, 0x85, 0xf7, 0x76, 0xfa, 0x19, 0xa9, 0x3a, 0xb9,
                0x6c, 0xc1, 0xee, 0xee, 0xe9, 0x47, 0xc1, 0x71, 0x13, 0x38,
                0x5f, 0x5f,
              ]),
              signature: Uint8Array.from([
                0x12, 0x4d, 0x63, 0x5c, 0xf2, 0x52, 0xae, 0x26, 0xa6, 0x7b,
                0xe2, 0x77, 0x71, 0x2e, 0xad, 0x07, 0xb4, 0x48, 0x96, 0xdf,
                0xb0, 0x16, 0xfc, 0x9d, 0x03, 0xa3, 0xe9, 0x22, 0xbd, 0x9a,
                0x01, 0x66, 0x3c, 0x59, 0x59, 0x41, 0x13, 0xe5, 0x71, 0x00,
                0x06, 0x3d, 0x9d, 0xcc, 0xd7, 0x8f, 0xb3, 0x93, 0x82, 0xdb,
                0xf8, 0x0a, 0x8f, 0x11, 0x50, 0xfd, 0x59, 0xd9, 0xfe, 0xb7,
                0x9e, 0x25, 0x3b, 0xd2,
              ]),
            },
          ],
        }),
      );
    });
  });
  describe("errors", () => {
    it("should return an error if continue task fails", async () => {
      // given
      const api = {
        sendCommand: jest.fn(),
      } as unknown as InternalApi;
      const psbt = {
        getGlobalValue: jest.fn(() => Nothing),
      } as unknown as Psbt;
      const wallet = {} as Wallet;
      const psbtCommitment = {} as PsbtCommitment;
      const dataStore = {} as DataStore;
      const walletSerializer = {
        getId: jest.fn(() => Uint8Array.from([0x05])),
      } as unknown as WalletSerializer;
      const valueParser = {
        getVarint: jest.fn(() => Maybe.of(42)),
      } as unknown as ValueParser;
      const continueTaskFactory = () =>
        ({
          run: jest.fn().mockResolvedValue(
            CommandResultFactory({
              error: new UnknownDeviceExchangeError("Failed"),
            }),
          ),
        }) as unknown as ContinueTask;
      // when
      const result = await new SignPsbtTask(
        api,
        {
          psbt,
          wallet,
          psbtCommitment,
          dataStore,
        },
        walletSerializer,
        valueParser,
        continueTaskFactory,
      ).run();
      // then
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new UnknownDeviceExchangeError("Failed"),
        }),
      );
    });
  });
});
