import {
  ClearSignContextReferenceType,
  ClearSignContextType,
  type ContextModule,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { type TransactionOptions } from "@api/index";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

import {
  BuildBaseContexts,
  type BuildBaseContextsArgs,
} from "./BuildBaseContexts";
import { BuildFullContextsTask } from "./BuildFullContextsTask";
import {
  BuildSubcontextsTask,
  type BuildSubcontextsTaskArgs,
} from "./BuildSubcontextsTask";
import {
  ParseNestedTransactionTask,
  type ParseNestedTransactionTaskArgs,
} from "./ParseNestedTransactionTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("BuildFullContextsTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const contextModuleMock = {} as ContextModule;
  const mapperMock = {} as TransactionMapperService;
  const parserMock = {} as TransactionParserService;

  const defaultAppConfig: GetConfigCommandResponse = {
    blindSigningEnabled: false,
    web3ChecksEnabled: false,
    web3ChecksOptIn: false,
    version: "1.0.0",
  };
  const defaultOptions: TransactionOptions = {};
  const defaultSubset: TransactionSubset = {
    chainId: 1,
    data: "0x",
    selector: "0x",
  };
  const defaultDerivationPath = "44'/60'/0'/0/0";

  const buildSubContextTaskRunMock = vi.fn();
  const buildSubcontextsTaskFactory = (
    _api: InternalApi,
    _args: BuildSubcontextsTaskArgs,
  ) =>
    ({
      run: buildSubContextTaskRunMock,
    }) as unknown as BuildSubcontextsTask;

  const buildBaseContextsTaskRunMock = vi.fn();
  const buildBaseContextsTaskFactory = (
    _api: InternalApi,
    _args: BuildBaseContextsArgs,
  ) =>
    ({
      run: buildBaseContextsTaskRunMock,
    }) as unknown as BuildBaseContexts;

  const parseNestedTransactionTaskRunMock = vi.fn();
  const parseNestedTransactionTaskFactory = (
    _args: ParseNestedTransactionTaskArgs,
  ) =>
    ({
      run: parseNestedTransactionTaskRunMock,
    }) as unknown as ParseNestedTransactionTask;

  describe("Init", () => {
    it("should init with defaults tasks", () => {
      const task = new BuildFullContextsTask(apiMock, {
        contextModule: contextModuleMock,
        mapper: mapperMock,
        parser: parserMock,
        options: defaultOptions,
        appConfig: defaultAppConfig,
        derivationPath: defaultDerivationPath,
        subset: defaultSubset,
        deviceModelId: DeviceModelId.STAX,
        logger: mockLogger,
      });

      expect(task).toBeDefined();
      expect(
        task["_buildSubcontextsTaskFactory"](
          apiMock,
          {} as BuildSubcontextsTaskArgs,
        ),
      ).toBeInstanceOf(BuildSubcontextsTask);
      expect(
        task["_buildBaseContextsTaskFactory"](
          apiMock,
          {} as BuildBaseContextsArgs,
        ),
      ).toBeInstanceOf(BuildBaseContexts);
      expect(
        task["_preBuildNestedCallDataTaskFactory"](
          {} as ParseNestedTransactionTaskArgs,
        ),
      ).toBeInstanceOf(ParseNestedTransactionTask);
    });
  });

  describe("Happy path", () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it("should build with no context", async () => {
      // GIVEN
      buildBaseContextsTaskRunMock.mockReturnValue({
        clearSignContexts: [],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.BASIC,
      });

      const task = new BuildFullContextsTask(
        apiMock,
        {
          contextModule: contextModuleMock,
          mapper: mapperMock,
          parser: parserMock,
          options: defaultOptions,
          appConfig: defaultAppConfig,
          derivationPath: defaultDerivationPath,
          subset: defaultSubset,
          deviceModelId: DeviceModelId.STAX,
          logger: mockLogger,
        },
        buildSubcontextsTaskFactory,
        buildBaseContextsTaskFactory,
        parseNestedTransactionTaskFactory,
      );

      // WHEN
      const result = await task.run();

      // THEN
      expect(result).toEqual({
        clearSignContexts: [],
        clearSigningType: ClearSigningType.BASIC,
      });
    });

    it("should build with multiple contexts and no subcontexts", async () => {
      // GIVEN
      buildBaseContextsTaskRunMock.mockReturnValueOnce({
        clearSignContexts: [
          {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "payload-1",
          },
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "payload-2",
          },
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "payload-3",
          },
        ],
        clearSigningType: ClearSigningType.EIP7730,
      });
      buildSubContextTaskRunMock.mockReturnValue({
        subcontextCallbacks: [],
      });

      const task = new BuildFullContextsTask(
        apiMock,
        {
          contextModule: contextModuleMock,
          mapper: mapperMock,
          parser: parserMock,
          options: defaultOptions,
          appConfig: defaultAppConfig,
          derivationPath: defaultDerivationPath,
          subset: defaultSubset,
          deviceModelId: DeviceModelId.STAX,
          logger: mockLogger,
        },
        buildSubcontextsTaskFactory,
        buildBaseContextsTaskFactory,
        parseNestedTransactionTaskFactory,
      );

      // WHEN
      const result = await task.run();

      // THEN
      expect(result).toEqual({
        clearSignContexts: [
          {
            context: {
              type: ClearSignContextType.TRANSACTION_INFO,
              payload: "payload-1",
            },
            subcontextCallbacks: [],
          },
          {
            context: {
              type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
              payload: "payload-2",
            },
            subcontextCallbacks: [],
          },
          {
            context: {
              type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
              payload: "payload-3",
            },
            subcontextCallbacks: [],
          },
        ],
        clearSigningType: ClearSigningType.EIP7730,
      });
    });

    it("should build with multiple contexts and subcontexts", async () => {
      // GIVEN
      buildBaseContextsTaskRunMock.mockReturnValueOnce({
        clearSignContexts: [
          {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "payload-1",
          },
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "payload-2",
          },
        ],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.EIP7730,
      });
      buildSubContextTaskRunMock.mockReturnValueOnce({
        subcontextCallbacks: [],
      });
      buildSubContextTaskRunMock.mockReturnValueOnce({
        subcontextCallbacks: [
          () =>
            Promise.resolve({
              type: ClearSignContextType.TOKEN,
              payload: "payload-3",
            }),
          () =>
            Promise.resolve({
              type: ClearSignContextType.TOKEN,
              payload: "payload-4",
            }),
        ],
      });

      const task = new BuildFullContextsTask(
        apiMock,
        {
          contextModule: contextModuleMock,
          mapper: mapperMock,
          parser: parserMock,
          options: defaultOptions,
          appConfig: defaultAppConfig,
          derivationPath: defaultDerivationPath,
          subset: defaultSubset,
          deviceModelId: DeviceModelId.STAX,
          logger: mockLogger,
        },
        buildSubcontextsTaskFactory,
        buildBaseContextsTaskFactory,
        parseNestedTransactionTaskFactory,
      );

      // WHEN
      const result = await task.run();

      // THEN
      expect(result.clearSignContexts[0]).toEqual({
        context: {
          type: ClearSignContextType.TRANSACTION_INFO,
          payload: "payload-1",
        },
        subcontextCallbacks: [],
      });
      expect(result.clearSignContexts[1]).toEqual({
        context: {
          type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          payload: "payload-2",
        },
        subcontextCallbacks: [expect.any(Function), expect.any(Function)],
      });
      await expect(
        result.clearSignContexts[1]!.subcontextCallbacks[0]!(),
      ).resolves.toEqual({
        type: ClearSignContextType.TOKEN,
        payload: "payload-3",
      });
      await expect(
        result.clearSignContexts[1]!.subcontextCallbacks[1]!(),
      ).resolves.toEqual({
        type: ClearSignContextType.TOKEN,
        payload: "payload-4",
      });
    });

    it("should build with nested contexts", async () => {
      // GIVEN
      buildBaseContextsTaskRunMock.mockReturnValueOnce({
        clearSignContexts: [
          {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "payload-1",
          },
          {
            type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
            payload: "payload-2",
            reference: {
              type: ClearSignContextReferenceType.CALLDATA,
              subset: {
                chainId: 1,
                data: "0x",
                selector: "0x",
              },
            },
          },
        ],
        clearSigningType: ClearSigningType.EIP7730,
      });
      // nested context
      buildBaseContextsTaskRunMock.mockReturnValueOnce({
        clearSignContexts: [
          {
            type: ClearSignContextType.TRANSACTION_INFO,
            payload: "payload-3",
          },
          {
            type: ClearSignContextType.TOKEN,
            payload: "payload-4",
          },
        ],
        clearSignContextsOptional: [],
        clearSigningType: ClearSigningType.EIP7730,
      });
      buildSubContextTaskRunMock.mockReturnValue({
        subcontextCallbacks: [],
      });
      parseNestedTransactionTaskRunMock.mockReturnValue({
        subsets: [
          {
            chainId: 1,
            data: "0x",
            selector: "0x",
          },
        ],
      });

      const task = new BuildFullContextsTask(
        apiMock,
        {
          contextModule: contextModuleMock,
          mapper: mapperMock,
          parser: parserMock,
          options: defaultOptions,
          appConfig: defaultAppConfig,
          derivationPath: defaultDerivationPath,
          subset: defaultSubset,
          deviceModelId: DeviceModelId.STAX,
          logger: mockLogger,
        },
        buildSubcontextsTaskFactory,
        buildBaseContextsTaskFactory,
        parseNestedTransactionTaskFactory,
      );

      // WHEN
      const result = await task.run();

      // THEN
      expect(result).toEqual({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        clearSignContexts: expect.any(Array),
        clearSigningType: ClearSigningType.EIP7730,
      });
      expect(result.clearSignContexts[0]).toEqual({
        context: {
          type: ClearSignContextType.TRANSACTION_INFO,
          payload: "payload-1",
        },
        subcontextCallbacks: [],
      });
      expect(result.clearSignContexts[1]).toEqual({
        context: {
          type: ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
          payload: "payload-2",
          reference: {
            type: ClearSignContextReferenceType.CALLDATA,
            subset: {
              chainId: 1,
              data: "0x",
              selector: "0x",
            },
          },
        },
        subcontextCallbacks: [],
      });
      expect(result.clearSignContexts[2]).toEqual({
        context: {
          type: ClearSignContextType.TRANSACTION_INFO,
          payload: "payload-3",
        },
        subcontextCallbacks: [],
      });
      expect(result.clearSignContexts[3]).toEqual({
        context: {
          type: ClearSignContextType.TOKEN,
          payload: "payload-4",
        },
        subcontextCallbacks: [],
      });
    });
  });
});
