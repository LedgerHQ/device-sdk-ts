import {
  CommandResultFactory,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type Psbt } from "@api/model/Psbt";
import { BuildPsbtTask } from "@internal/app-binder/task/BuildPsbtTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import {
  type DataStoreService,
  type PsbtCommitment,
} from "@internal/data-store/service/DataStoreService";
import { type Psbt as InternalPsbt } from "@internal/psbt/model/Psbt";
import { type Wallet } from "@internal/wallet/model/Wallet";

describe("BuildPsbtTask", () => {
  it("should build psbt and fill datastore", async () => {
    // given
    const psbtMapper = {
      map: jest.fn(() => Right("InternalPsbt" as unknown as InternalPsbt)),
    };
    const dataStoreService = {
      merklizeWallet: jest.fn(),
      merklizePsbt: jest.fn(() =>
        Right("PsbtCommitment" as unknown as PsbtCommitment),
      ),
    } as unknown as DataStoreService;
    const dataStore = new DataStore();
    const task = new BuildPsbtTask(
      {
        wallet: "Wallet" as unknown as Wallet,
        psbt: "ApiPsbt" as unknown as Psbt,
      },
      dataStoreService,
      psbtMapper,
      () => dataStore,
    );
    // when
    const result = await task.run();
    // then
    expect(psbtMapper.map).toHaveBeenCalledWith("ApiPsbt");
    expect(dataStoreService.merklizePsbt).toHaveBeenCalledWith(
      dataStore,
      "InternalPsbt",
    );
    expect(dataStoreService.merklizeWallet).toHaveBeenCalledWith(
      dataStore,
      "Wallet",
    );
    expect(result).toStrictEqual(
      CommandResultFactory({
        data: {
          psbtCommitment: "PsbtCommitment",
          dataStore,
          psbt: "InternalPsbt",
        },
      }),
    );
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
      dataStoreService,
      psbtMapper,
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
      dataStoreService,
      psbtMapper,
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
