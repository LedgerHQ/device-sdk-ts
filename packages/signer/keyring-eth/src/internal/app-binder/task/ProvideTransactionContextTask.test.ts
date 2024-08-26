import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  UnknownDeviceExchangeError,
} from "@ledgerhq/device-sdk-core";

import { ProvideDomainNameCommand } from "@internal/app-binder/command/ProvideDomainNameCommand";
import { ProvideNFTInformationCommand } from "@internal/app-binder/command/ProvideNFTInformationCommand";
import { ProvideTokenInformationCommand } from "@internal/app-binder/command/ProvideTokenInformationCommand";
import { SetExternalPluginCommand } from "@internal/app-binder/command/SetExternalPluginCommand";
import { SetPluginCommand } from "@internal/app-binder/command/SetPluginCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import {
  type ErrorCodes,
  ProvideTransactionContextTask,
  type ProvideTransactionContextTaskArgs,
} from "./ProvideTransactionContextTask";

describe("ProvideTransactionContextTask", () => {
  const api = makeDeviceActionInternalApiMock();
  const successResult = CommandResultFactory<void, ErrorCodes>({
    data: undefined,
  });
  const errorResult = CommandResultFactory<void, ErrorCodes>({
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
    };
    afterEach(() => {
      jest.restoreAllMocks();
    });
    it("should send relative commands when receiving ClearSignContexts of type not domainName", async () => {
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
    it("should call provideDomainNameTask when receiving a ClearSignContext of type domainName", async () => {
      jest
        .spyOn(ProvideTransactionContextTask.prototype, "provideDomainNameTask")
        .mockResolvedValueOnce(CommandResultFactory<void>({ data: undefined }));
      // GIVEN
      const task = new ProvideTransactionContextTask(api, {
        clearSignContexts: [
          {
            type: ClearSignContextType.DOMAIN_NAME,
            payload: "646f6d61696e4e616d65", // "domainName"
          },
        ],
      });
      // WHEN
      await task.run();
      // THEN
      expect(
        ProvideTransactionContextTask.prototype.provideDomainNameTask,
      ).toHaveBeenCalledTimes(1);
      expect(
        ProvideTransactionContextTask.prototype.provideDomainNameTask,
      ).toHaveBeenCalledWith("646f6d61696e4e616d65");
    });
    it("should return the command error result and stop when provideDomainNameTask fails", async () => {
      jest
        .spyOn(ProvideTransactionContextTask.prototype, "provideDomainNameTask")
        .mockResolvedValueOnce(
          CommandResultFactory<void>({
            data: undefined,
            error: {} as UnknownDeviceExchangeError,
          }),
        );
      // GIVEN
      const task = new ProvideTransactionContextTask(api, {
        clearSignContexts: [
          {
            type: ClearSignContextType.DOMAIN_NAME,
            payload: "646f6d61696e4e616d65", // "domainName"
          },
          {
            type: ClearSignContextType.PLUGIN,
            payload: "706c7567696e", // "plugin"
          },
        ],
      });
      // WHEN
      const result = await task.run();
      // THEN
      expect(result.isJust()).toBe(true);
      expect(result.extract()).toStrictEqual(errorResult);
    });
  });

  describe("provideDomainNameTask", () => {
    it("should send the multiple ProvideDomainNameCommand to the device", async () => {
      // GIVEN
      api.sendCommand.mockResolvedValue(successResult);
      const task = new ProvideTransactionContextTask(api, {
        clearSignContexts: [],
      });
      // WHEN
      const domainName = "646f6d61696e4e616d65"; // "domainName"
      await task.provideDomainNameTask(domainName);
      // THEN
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
      expect(api.sendCommand).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining(
          new ProvideDomainNameCommand({
            data: Uint8Array.from([
              0x00, 0x0a, 0x64, 0x6f, 0x6d, 0x61, 0x69, 0x6e, 0x4e, 0x61, 0x6d,
              0x65,
            ]),
            isFirstChunk: true,
          }),
        ),
      );
    });
    it("should return the error and stop when command fails", async () => {
      // GIVEN
      api.sendCommand.mockResolvedValueOnce(errorResult);
      const task = new ProvideTransactionContextTask(api, {
        clearSignContexts: [],
      });
      // WHEN
      const domainName = "646f6d61696e4e616d65"; // "domainName"
      const res = await task.provideDomainNameTask(domainName);
      //THEN
      expect(api.sendCommand).toHaveBeenCalledTimes(1);
      expect(res).toStrictEqual(errorResult);
    });
  });
});
