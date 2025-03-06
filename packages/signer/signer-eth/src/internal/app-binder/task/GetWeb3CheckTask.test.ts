import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type TypedData } from "@api/model/TypedData";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { GetWeb3CheckTask } from "@internal/app-binder/task/GetWeb3CheckTask";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

describe("GetWeb3CheckTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const contextModuleMock = {
    getWeb3Checks: vi.fn(),
  };
  const mapperMock = {
    mapTransactionToSubset: vi.fn(),
  };
  const transaction = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
  const derivationPath = "44'/60'/0'/0/0";

  describe("run", () => {
    beforeEach(() => {
      vi.clearAllMocks();

      apiMock.getDeviceSessionState.mockReturnValueOnce({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Ethereum", version: "1.15.0" },
        deviceModelId: DeviceModelId.FLEX,
        isSecureConnectionAllowed: true,
      });
    });

    describe("errors", () => {
      it("should throw an error if mapTransactionToSubset assert.fails", async () => {
        // GIVEN
        const error = new Error("error");
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            data: { web3ChecksEnabled: true, web3ChecksOptIn: true },
          }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { address: "address" } }),
        );
        mapperMock.mapTransactionToSubset.mockReturnValue(Left(error));

        // WHEN
        try {
          await new GetWeb3CheckTask(apiMock, {
            contextModule: contextModuleMock as unknown as ContextModule,
            mapper: mapperMock as unknown as TransactionMapperService,
            transaction,
            derivationPath,
          }).run();
          assert.fail("should throw an error");
        } catch (e) {
          // THEN
          expect(e).toEqual(error);
        }
      });

      it("should return a context error if GetAppConfiguration assert.fails", async () => {
        // GIVEN
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValue(
          CommandResultFactory({ error: new InvalidStatusWordError("error") }),
        );

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check: null,
          error: new InvalidStatusWordError("error"),
        });
      });

      it("should return a context error if Web3CheckOptInCommand assert.fails", async () => {
        // GIVEN
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            data: { web3ChecksEnabled: false, web3ChecksOptIn: false },
          }),
        );
        apiMock.sendCommand.mockResolvedValue(
          CommandResultFactory({ error: new InvalidStatusWordError("error") }),
        );

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check: null,
          error: new InvalidStatusWordError("error"),
        });
      });

      it("should return a context error if GetAddressCommand assert.fails", async () => {
        // GIVEN
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            data: { web3ChecksEnabled: true, web3ChecksOptIn: true },
          }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ error: new InvalidStatusWordError("error") }),
        );

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check: null,
          error: new InvalidStatusWordError("error"),
        });
      });

      it("should return null if the type is not a ClearSignContextSuccess web3check", async () => {
        // GIVEN
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            data: { web3ChecksEnabled: true, web3ChecksOptIn: true },
          }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { address: "address" } }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue({
          type: "invalid-type",
          id: 1,
        });

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check: null,
        });
      });
    });

    describe("success", () => {
      it("should return null if web3ChecksEnabled is false", async () => {
        // GIVEN
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValue(
          CommandResultFactory({
            data: { web3ChecksEnabled: false, web3ChecksOptIn: true },
          }),
        );

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check: null,
        });
      });

      it("should return null if the context module does not have a web3 check", async () => {
        // GIVEN
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValue(
          CommandResultFactory({
            data: { web3ChecksEnabled: true, web3ChecksOptIn: true },
          }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(null);

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check: null,
        });
      });

      it("should return a web3 check", async () => {
        // GIVEN
        const web3Check = { type: "web3Check", id: 1 };
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValue(
          CommandResultFactory({
            data: { web3ChecksEnabled: true, web3ChecksOptIn: true },
          }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(web3Check);

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check,
        });
      });

      it("should opt-in and then return the web3check", async () => {
        // GIVEN
        const web3Check = { type: "web3Check", id: 1 };
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            data: { web3ChecksEnabled: false, web3ChecksOptIn: false },
          }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { enabled: true } }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(web3Check);

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check,
        });
      });

      it("should opt-in and then return a null if disabled", async () => {
        // GIVEN
        const web3Check = { type: "web3Check", id: 1 };
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({ subset: {}, serializedTransaction: new Uint8Array() }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            data: { web3ChecksEnabled: false, web3ChecksOptIn: false },
          }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { enabled: false } }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(web3Check);

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check: null,
        });
      });

      it("should return a web3 check for typed data", async () => {
        // GIVEN
        const web3Check = { type: "web3Check", id: 1 };
        apiMock.sendCommand.mockResolvedValue(
          CommandResultFactory({
            data: { web3ChecksEnabled: true, web3ChecksOptIn: true },
          }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(web3Check);

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          data: "typed data" as unknown as TypedData,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check,
        });
      });

      it("should call the context module with the right parameters", async () => {
        // GIVEN
        mapperMock.mapTransactionToSubset.mockReturnValue(
          Right({
            subset: { chainId: 15, from: "from" },
            serializedTransaction: new Uint8Array([0x01, 0x02, 0x03]),
          }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({
            data: { web3ChecksEnabled: true, web3ChecksOptIn: true },
          }),
        );
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { address: "address" } }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(null);

        // WHEN
        await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          mapper: mapperMock as unknown as TransactionMapperService,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(contextModuleMock.getWeb3Checks).toHaveBeenCalledWith({
          deviceModelId: DeviceModelId.FLEX,
          from: "address",
          rawTx: "0x010203",
          chainId: 15,
        });
      });
    });
  });
});
