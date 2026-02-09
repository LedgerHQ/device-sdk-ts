import {
  CommandResultFactory,
  DeviceActionStatus,
  GLOBAL_ERRORS,
  GlobalCommandError,
  RefusedByUserDAError,
  UnknownDAError,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { makeDeviceActionInternalApiMock } from "@api/device-action/__test-utils__/makeInternalApi";
import { setupGoToDashboardMock } from "@api/device-action/__test-utils__/setupTestMachine";
import { testDeviceActionStates } from "@api/device-action/__test-utils__/testDeviceActionStates";
import { InvalidCustomLockScreenImageDataDAError } from "@api/device-action/customLockScreenDeviceActionErrors";
import {
  splitIntoUploadChunks,
  UPLOAD_MAX_CHUNK_SIZE,
} from "@api/device-action/utils/chunkUtils";

import {
  type UploadCustomLockScreenDAError,
  type UploadCustomLockScreenDARequiredInteraction,
  type UploadCustomLockScreenDAState,
} from "./types";
import { UploadCustomLockScreenDeviceAction } from "./UploadCustomLockScreenDeviceAction";

vi.mock("@ledgerhq/device-management-kit", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@ledgerhq/device-management-kit")>();
  return {
    ...original,
    GoToDashboardDeviceAction: vi.fn(),
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// State builders
// ─────────────────────────────────────────────────────────────────────────────

const pendingState = (
  requiredUserInteraction: UploadCustomLockScreenDARequiredInteraction,
  progress?: number,
): UploadCustomLockScreenDAState => ({
  intermediateValue: {
    requiredUserInteraction,
    ...(progress !== undefined && { progress }),
  },
  status: DeviceActionStatus.Pending,
});

const completedState = (
  imageHash: string,
  imageSize: number,
): UploadCustomLockScreenDAState => ({
  output: { imageHash, imageSize },
  status: DeviceActionStatus.Completed,
});

const errorState = (
  error: UploadCustomLockScreenDAError,
): UploadCustomLockScreenDAState => ({
  error,
  status: DeviceActionStatus.Error,
});

// ─────────────────────────────────────────────────────────────────────────────
// Expected states builder for success scenarios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds expected states for a successful upload.
 * @param imageSize - Total image size in bytes
 * @param imageHash - Expected hash in output
 */
const buildSuccessStates = (
  imageSize: number,
  imageHash: string,
): UploadCustomLockScreenDAState[] => {
  const chunks = splitIntoUploadChunks(new Uint8Array(imageSize));
  const chunkCount = chunks.length;

  const states: UploadCustomLockScreenDAState[] = [
    // DeviceReady
    pendingState(UserInteractionRequired.None),
    // GoToDashboard done
    pendingState(UserInteractionRequired.None),
    // CreateImage - user confirms load
    pendingState(UserInteractionRequired.ConfirmLoadImage),
  ];

  // UploadChunk states - one per chunk with progress (chunkIndex / chunkCount)
  for (let i = 0; i < chunkCount; i++) {
    const progress = i / chunkCount;
    states.push(pendingState(UserInteractionRequired.None, progress));
  }

  // CommitImage - user confirms commit
  states.push(pendingState(UserInteractionRequired.ConfirmCommitImage, 1));
  // GetImageSize
  states.push(pendingState(UserInteractionRequired.None));
  // GetImageHash
  states.push(pendingState(UserInteractionRequired.None));
  // Success
  states.push(completedState(imageHash, imageSize));

  return states;
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock setup helper for success scenarios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sets up mocks for a successful upload.
 */
const setupSuccessMocks = (
  sendCommandMock: ReturnType<
    typeof makeDeviceActionInternalApiMock
  >["sendCommand"],
  imageSize: number,
  imageHash: string,
) => {
  const chunkCount = splitIntoUploadChunks(new Uint8Array(imageSize)).length;

  // Create image
  sendCommandMock.mockResolvedValueOnce(
    CommandResultFactory({ data: undefined }),
  );
  // Upload chunks
  for (let i = 0; i < chunkCount; i++) {
    sendCommandMock.mockResolvedValueOnce(
      CommandResultFactory({ data: undefined }),
    );
  }
  // Commit image
  sendCommandMock.mockResolvedValueOnce(
    CommandResultFactory({ data: undefined }),
  );
  // Get image size
  sendCommandMock.mockResolvedValueOnce(
    CommandResultFactory({ data: imageSize }),
  );
  // Get image hash
  sendCommandMock.mockResolvedValueOnce(
    CommandResultFactory({ data: { hash: imageHash } }),
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("UploadCustomLockScreenDeviceAction", () => {
  const { sendCommand: sendCommandMock } = makeDeviceActionInternalApiMock();

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("success cases", () => {
    it("should upload a small image (single chunk)", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const imageSize = 5;
        const imageHash = "smallhash123";
        const imageData = new Uint8Array(imageSize).fill(0x01);

        setupSuccessMocks(sendCommandMock, imageSize, imageHash);

        testDeviceActionStates(
          new UploadCustomLockScreenDeviceAction({ input: { imageData } }),
          buildSuccessStates(imageSize, imageHash),
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should upload a multi-chunk image (500 bytes = 2 chunks)", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const imageSize = 500;
        const imageHash = "multichunkhash123";
        const imageData = new Uint8Array(imageSize).fill(0xaa);

        setupSuccessMocks(sendCommandMock, imageSize, imageHash);

        testDeviceActionStates(
          new UploadCustomLockScreenDeviceAction({ input: { imageData } }),
          buildSuccessStates(imageSize, imageHash),
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    describe("chunk boundary tests", () => {
      it.each([
        { name: "MAX_CHUNK_SIZE - 1", imageSize: UPLOAD_MAX_CHUNK_SIZE - 1 },
        { name: "exactly MAX_CHUNK_SIZE", imageSize: UPLOAD_MAX_CHUNK_SIZE },
        { name: "MAX_CHUNK_SIZE + 1", imageSize: UPLOAD_MAX_CHUNK_SIZE + 1 },
      ])(
        "should handle image of $name bytes",
        ({ imageSize }) =>
          new Promise<void>((resolve, reject) => {
            setupGoToDashboardMock();
            const imageHash = `hash_${imageSize}`;
            const imageData = new Uint8Array(imageSize).fill(0xbb);

            setupSuccessMocks(sendCommandMock, imageSize, imageHash);

            testDeviceActionStates(
              new UploadCustomLockScreenDeviceAction({ input: { imageData } }),
              buildSuccessStates(imageSize, imageHash),
              makeDeviceActionInternalApiMock(),
              { onDone: resolve, onError: reject },
            );
          }),
      );
    });
  });

  describe("error cases", () => {
    it("should return an error if GoToDashboard fails", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock(true);
        const imageData = new Uint8Array([0x01, 0x02, 0x03]);

        const expectedStates: UploadCustomLockScreenDAState[] = [
          pendingState(UserInteractionRequired.None),
          pendingState(UserInteractionRequired.None),
          errorState(new UnknownDAError("GoToDashboard failed")),
        ];

        testDeviceActionStates(
          new UploadCustomLockScreenDeviceAction({ input: { imageData } }),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should return an error if CreateImage fails with user refused", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const imageData = new Uint8Array([0x01, 0x02, 0x03]);
        const globalError = new GlobalCommandError({
          errorCode: "5501",
          ...GLOBAL_ERRORS["5501"],
        });

        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ error: globalError }),
        );

        const expectedStates: UploadCustomLockScreenDAState[] = [
          pendingState(UserInteractionRequired.None),
          pendingState(UserInteractionRequired.None),
          pendingState(UserInteractionRequired.ConfirmLoadImage),
          errorState(new RefusedByUserDAError("User refused on device")),
        ];

        testDeviceActionStates(
          new UploadCustomLockScreenDeviceAction({ input: { imageData } }),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should return an error if CommitImage fails with user refused", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const imageData = new Uint8Array([0x01, 0x02, 0x03]);
        const globalError = new GlobalCommandError({
          errorCode: "5501",
          ...GLOBAL_ERRORS["5501"],
        });

        // Create image success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: undefined }),
        );
        // Upload chunk success
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ data: undefined }),
        );
        // Commit image fails
        sendCommandMock.mockResolvedValueOnce(
          CommandResultFactory({ error: globalError }),
        );

        const expectedStates: UploadCustomLockScreenDAState[] = [
          pendingState(UserInteractionRequired.None),
          pendingState(UserInteractionRequired.None),
          pendingState(UserInteractionRequired.ConfirmLoadImage),
          pendingState(UserInteractionRequired.None, 0),
          pendingState(UserInteractionRequired.ConfirmCommitImage, 1),
          errorState(new RefusedByUserDAError("User refused on device")),
        ];

        testDeviceActionStates(
          new UploadCustomLockScreenDeviceAction({ input: { imageData } }),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));

    it("should return an error if image data is empty", () =>
      new Promise<void>((resolve, reject) => {
        setupGoToDashboardMock();
        const imageData = new Uint8Array(0);

        // No command mocks needed - error happens immediately before any commands

        const expectedStates: UploadCustomLockScreenDAState[] = [
          // DeviceReady immediately transitions to Error (no GoToDashboard)
          errorState(
            new InvalidCustomLockScreenImageDataDAError("Image data is empty"),
          ),
        ];

        testDeviceActionStates(
          new UploadCustomLockScreenDeviceAction({ input: { imageData } }),
          expectedStates,
          makeDeviceActionInternalApiMock(),
          { onDone: resolve, onError: reject },
        );
      }));
  });
});
