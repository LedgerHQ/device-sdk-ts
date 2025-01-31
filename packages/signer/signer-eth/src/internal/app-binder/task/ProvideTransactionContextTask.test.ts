import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  type UnknownDeviceExchangeError,
} from "@ledgerhq/device-management-kit";

import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { SetExternalPluginCommand } from "@internal/app-binder/command/SetExternalPluginCommand";
import { SetPluginCommand } from "@internal/app-binder/command/SetPluginCommand";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import {
  ProvideTransactionContextTask,
  type ProvideTransactionContextTaskArgs,
} from "./ProvideTransactionContextTask";

describe("ProvideTransactionContextTask", () => {
  const api = makeDeviceActionInternalApiMock();
  const successResult = CommandResultFactory<void, EthErrorCodes>({
    data: undefined,
  });
  const errorResult = CommandResultFactory<void, EthErrorCodes>({
    data: undefined,
    error: {} as UnknownDeviceExchangeError,
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("run", () => {
    const args: ProvideTransactionContextTaskArgs = {
      clearSignContexts: [
        {
          type: ClearSignContextType.PLUGIN,
          payload: "706c7567696e", // "plugin"
        },
        {
          type: ClearSignContextType.EXTERNAL_PLUGIN,
          payload: "65787465726e616c506c7567696e", // "externalPlugin"
        },
        {
          type: ClearSignContextType.NFT,
          payload: "6e6674", // "nft"
        },
        {
          type: ClearSignContextType.TOKEN,
          payload: "746f6b656e", // "token"
        },
      ],
      web3Check: null,
    };
    afterEach(() => {
      jest.restoreAllMocks();
    });
    it("should send relative commands when receiving ClearSignContexts of type not trustedName", async () => {
      api.sendCommand.mockResolvedValue(successResult);
      // GIVEN
      const task = new ProvideTransactionContextTask(api, args);
      // WHEN
      await task.run();
      // THEN
      expect(api.sendCommand).toHaveBeenCalledTimes(4);
      expect(api.sendCommand).toHaveBeenNthCalledWith(
        args.clearSignContexts.findIndex(
          (c) => c.type === ClearSignContextType.PLUGIN,
        ) + 1,
        expect.objectContaining(
          new SetPluginCommand({ payload: "706c7567696e" }),
        ),
      );
      expect(api.sendCommand).toHaveBeenNthCalledWith(
        args.clearSignContexts.findIndex(
          (c) => c.type === ClearSignContextType.EXTERNAL_PLUGIN,
        ) + 1,
        expect.objectContaining(
          new SetExternalPluginCommand({
            payload: "65787465726e616c506c7567696e",
          }),
        ),
      );
      expect(api.sendCommand).toHaveBeenNthCalledWith(
        args.clearSignContexts.findIndex(
          (c) => c.type === ClearSignContextType.NFT,
        ) + 1,
        expect.objectContaining(
          new ProvideNFTInformationCommand({ payload: "6e6674" }),
        ),
      );
      expect(api.sendCommand).toHaveBeenNthCalledWith(
        args.clearSignContexts.findIndex(
          (c) => c.type === ClearSignContextType.TOKEN,
        ) + 1,
        expect.objectContaining(
          new ProvideTokenInformationCommand({ payload: "746f6b656e" }),
        ),
      );
    });
    it("should return the command error result and stop when the command fails", async () => {
      api.sendCommand.mockReset();
      api.sendCommand.mockResolvedValueOnce(errorResult);
      // GIVEN
      const task = new ProvideTransactionContextTask(api, args);
      // WHEN
      const result = await task.run();
      // THEN
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
      expect(result.isJust()).toBe(true);
      expect(result.extract()).toStrictEqual(errorResult);
    });
  });
});
