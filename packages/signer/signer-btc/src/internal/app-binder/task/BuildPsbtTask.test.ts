import {
  CommandResultFactory,
  isSuccessCommandResult,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Left, Nothing, Right } from "purify-ts";

import { type Psbt } from "@api/model/Psbt";
import { BuildPsbtTask } from "@internal/app-binder/task/BuildPsbtTask";
import { type PsbtCommitment } from "@internal/data-store/service/DataStoreService";
import { type Psbt as InternalPsbt } from "@internal/psbt/model/Psbt";
import { type Wallet } from "@internal/wallet/model/Wallet";

describe("BuildPsbtTask", () => {
  it("should build psbt and fill datastore", async () => {
    // given
    const psbtMapper = {
      map: jest.fn(() =>
        Right({
          getGlobalValue: jest.fn(() => Nothing),
        } as unknown as InternalPsbt),
      ),
    };
    const dataStoreService = {
      merklizeWallet: jest.fn(),
      merklizePsbt: jest.fn(() => Right({} as PsbtCommitment)),
      merklizeChunks: jest.fn(),
    };
    const task = new BuildPsbtTask(
      {
        wallet: {} as unknown as Wallet,
        psbt: {
          getGlobalValue: jest.fn(),
        } as unknown as Psbt,
      },
      psbtMapper,
      dataStoreService,
    );
    // when
    const result = await task.run();
    // then
    expect(isSuccessCommandResult(result)).toBe(true);
  });
  it("should return an error if datastore fails", async () => {
    // given
    const psbtMapper = {
      map: jest.fn(() => Right({} as InternalPsbt)),
    };
    const error = new Error("Failed");
    const dataStoreService = {
      merklizeWallet: jest.fn(),
      merklizePsbt: jest.fn(() => Left(error)),
      merklizeChunks: jest.fn(),
    };
    const task = new BuildPsbtTask(
      {
        wallet: {} as unknown as Wallet,
        psbt: {} as unknown as Psbt,
      },
      psbtMapper,
      dataStoreService,
    );
    // when
    const result = await task.run();
    // then
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new UnknownDeviceExchangeError({ error }),
      }),
    );
  });
  it("should return an error if datastore fails", async () => {
    // given
    const error = new Error("Failed");
    const psbtMapper = {
      map: jest.fn(() => Left(error)),
    };
    const dataStoreService = {
      merklizeWallet: jest.fn(),
      merklizePsbt: jest.fn(() => Right({} as PsbtCommitment)),
      merklizeChunks: jest.fn(),
    };
    const task = new BuildPsbtTask(
      {
        wallet: {} as unknown as Wallet,
        psbt: {} as unknown as Psbt,
      },
      psbtMapper,
      dataStoreService,
    );
    // when
    const result = await task.run();
    // then
    expect(result).toStrictEqual(
      CommandResultFactory({
        error: new UnknownDeviceExchangeError({ error }),
      }),
    );
  });
});
