import { type ContextModule } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  DeviceModelId,
  DeviceSessionStateType,
  DeviceStatus,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type TypedData } from "@api/model/TypedData";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { GetWeb3CheckTask } from "@internal/app-binder/task/GetWeb3CheckTask";

describe("GetWeb3CheckTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const contextModuleMock = {
    getWeb3Checks: vi.fn(),
  };
  const transaction = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
  const derivationPath = "44'/60'/0'/0/0";
  const defaultSubset = {
    chainId: 15,
    to: "to",
    data: "0x060708090A",
    selector: "0x06070809",
    value: 0n,
  };

  describe("run", () => {
    beforeEach(() => {
      vi.clearAllMocks();

      apiMock.getDeviceSessionState.mockReturnValueOnce({
        sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
        deviceStatus: DeviceStatus.CONNECTED,
        installedApps: [],
        currentApp: { name: "Ethereum", version: "1.16.0" },
        deviceModelId: DeviceModelId.FLEX,
        isSecureConnectionAllowed: true,
      });
    });

    describe("errors", () => {
      it("should return a context error if GetAddressCommand assert.fails", async () => {
        // GIVEN
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ error: new InvalidStatusWordError("error") }),
        );

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          subset: defaultSubset,
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
          subset: defaultSubset,
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
      it("should return null if the context module does not have a web3 check", async () => {
        // GIVEN
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { address: "address" } }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(null);

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          subset: defaultSubset,
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
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { address: "address" } }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(web3Check);

        // WHEN
        const result = await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          subset: defaultSubset,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(result).toEqual({
          web3Check,
        });
      });

      it("should return a web3 check for typed data", async () => {
        // GIVEN
        const web3Check = { type: "web3Check", id: 1 };
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { address: "address" } }),
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
        apiMock.sendCommand.mockResolvedValueOnce(
          CommandResultFactory({ data: { address: "address" } }),
        );
        contextModuleMock.getWeb3Checks.mockResolvedValue(null);

        // WHEN
        await new GetWeb3CheckTask(apiMock, {
          contextModule: contextModuleMock as unknown as ContextModule,
          subset: defaultSubset,
          transaction,
          derivationPath,
        }).run();

        // THEN
        expect(contextModuleMock.getWeb3Checks).toHaveBeenCalledWith({
          deviceModelId: DeviceModelId.FLEX,
          from: "address",
          rawTx: "0x01020304",
          chainId: 15,
        });
      });
    });
  });
});
