import {
  ApduResponse,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import {
  CHUNK_SIZE,
  SHA256_SIZE,
} from "@internal/app-binder/command/utils/constants";
import { NullLoggerPublisherService } from "@internal/app-binder/services/utils/NullLoggerPublisherService";
import { type ContinueTask } from "@internal/app-binder/task/ContinueTask";
import { DataStore } from "@internal/data-store/model/DataStore";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";

import { SendSignMessageTask } from "./SignMessageTask";

const EXACT_ONE_CHUNK_MESSAGE = "a".repeat(CHUNK_SIZE);
const EXACT_TWO_CHUNKS_MESSAGE = "a".repeat(CHUNK_SIZE * 2);
const DERIVATION_PATH = "44'/0'/0'/0/0";
const MERKLE_ROOT = new Uint8Array(SHA256_SIZE).fill(0x01);

const SIGNATURE: Signature = {
  v: 27,
  r: "0x97a4ca8f694633592601f5a23e0bcc553c9d0a90d3a3422d575508a92898b96e",
  s: "0x6950d02e74e9c102c164a225533082cabdd890efc463f67f60cefe8c3f87cfce",
};

const SIGNATURE_APDU = new Uint8Array([
  0x1b, 0x97, 0xa4, 0xca, 0x8f, 0x69, 0x46, 0x33, 0x59, 0x26, 0x01, 0xf5, 0xa2,
  0x3e, 0x0b, 0xcc, 0x55, 0x3c, 0x9d, 0x0a, 0x90, 0xd3, 0xa3, 0x42, 0x2d, 0x57,
  0x55, 0x08, 0xa9, 0x28, 0x98, 0xb9, 0x6e, 0x69, 0x50, 0xd0, 0x2e, 0x74, 0xe9,
  0xc1, 0x02, 0xc1, 0x64, 0xa2, 0x25, 0x53, 0x30, 0x82, 0xca, 0xbd, 0xd8, 0x90,
  0xef, 0xc4, 0x63, 0xf6, 0x7f, 0x60, 0xce, 0xfe, 0x8c, 0x3f, 0x87, 0xcf, 0xce,
]);

describe("SignMessageTask", () => {
  const signatureResult = CommandResultFactory<ApduResponse, void>({
    data: new ApduResponse({
      statusCode: new Uint8Array([0x90, 0x00]),
      data: SIGNATURE_APDU,
    }),
  });
  const apiMock = {
    sendCommand: vi.fn(),
  } as unknown as InternalApi;

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("run", () => {
    it("should correctly chunk a message that fits in 1 chunk", async () => {
      // GIVEN
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_ONE_CHUNK_MESSAGE,
        loggerFactory: NullLoggerPublisherService,
      };

      const dataStoreService = {
        merklizeChunks: vi.fn().mockReturnValue(MERKLE_ROOT),
      } as unknown as DataStoreService;

      const continueTaskFactory = () =>
        ({
          run: vi.fn().mockReturnValue(signatureResult),
        }) as unknown as ContinueTask;

      // WHEN
      const result = await new SendSignMessageTask(
        apiMock,
        args,
        dataStoreService,
        continueTaskFactory,
      ).run();

      // THEN
      expect(dataStoreService.merklizeChunks).toHaveBeenCalledWith(
        expect.any(DataStore),
        [Uint8Array.from(new Array(64).fill(0x61))],
      );
      expect(result).toStrictEqual(CommandResultFactory({ data: SIGNATURE }));
    });

    it("should correctly chunk a message that fits in 2 chunks", async () => {
      // GIVEN
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_TWO_CHUNKS_MESSAGE,
        loggerFactory: NullLoggerPublisherService,
      };

      const dataStoreService = {
        merklizeChunks: vi.fn().mockReturnValue(MERKLE_ROOT),
      } as unknown as DataStoreService;

      const continueTaskFactory = () =>
        ({
          run: vi.fn().mockReturnValue(signatureResult),
        }) as unknown as ContinueTask;

      // WHEN
      const result = await new SendSignMessageTask(
        apiMock,
        args,
        dataStoreService,
        continueTaskFactory,
      ).run();

      // THEN
      expect(dataStoreService.merklizeChunks).toHaveBeenCalledWith(
        expect.any(DataStore),
        [
          Uint8Array.from(new Array(64).fill(0x61)),
          Uint8Array.from(new Array(64).fill(0x61)),
        ],
      );
      expect(result).toStrictEqual(CommandResultFactory({ data: SIGNATURE }));
    });

    it("should return an error if the initial SignMessageCommand fails", async () => {
      // GIVEN
      const args = {
        derivationPath: DERIVATION_PATH,
        message: EXACT_ONE_CHUNK_MESSAGE,
        loggerFactory: NullLoggerPublisherService,
      };

      const resultError = CommandResultFactory<Signature, void>({
        error: new InvalidStatusWordError("error"),
      });
      const dataStoreService = {
        merklizeChunks: vi.fn().mockReturnValue(MERKLE_ROOT),
      } as unknown as DataStoreService;

      const continueTaskFactory = () =>
        ({
          run: vi.fn().mockReturnValue(resultError),
        }) as unknown as ContinueTask;

      // WHEN
      const result = await new SendSignMessageTask(
        apiMock,
        args,
        dataStoreService,
        continueTaskFactory,
      ).run();

      // THEN
      expect(result).toStrictEqual(
        CommandResultFactory({
          error: new InvalidStatusWordError("error"),
        }),
      );
    });
  });
});
