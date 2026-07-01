import {
  type DeviceManagementKit,
  type DeviceSessionId,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { describe, expect, it, vi } from "vitest";

import { GetAddressCommand } from "@internal/app-binder/command/GetAddressCommand";
import { APP_NAME } from "@internal/app-binder/constants";

import { PolkadotAppBinder } from "./PolkadotAppBinder";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("PolkadotAppBinder", () => {
  const sessionId = "test-session-id" as DeviceSessionId;
  const mockedDmk = {
    executeDeviceAction: vi.fn(),
  } as unknown as DeviceManagementKit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    const binder = new PolkadotAppBinder(
      mockedDmk,
      sessionId,
      mockLoggerFactory,
    );
    expect(binder).toBeDefined();
  });

  describe("getAddress", () => {
    it("should call executeDeviceAction with VerifyAddress when checkOnDevice is true", () => {
      // ARRANGE
      const args = {
        derivationPath: "44'/354'/0'/0'/0'",
        ss58Prefix: 13116,
        checkOnDevice: true,
        skipOpenApp: false,
      };
      const binder = new PolkadotAppBinder(
        mockedDmk,
        sessionId,
        mockLoggerFactory,
      );
      // ACT
      binder.getAddress(args);
      // ASSERT
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          deviceAction: expect.objectContaining({
            input: {
              command: new GetAddressCommand(args),
              appName: APP_NAME,
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              skipOpenApp: false,
            },
          }),
        }),
      );
    });

    it("should call executeDeviceAction with None when checkOnDevice is false", () => {
      // ARRANGE
      const args = {
        derivationPath: "44'/354'/0'/0'/0'",
        ss58Prefix: 0,
        checkOnDevice: false,
        skipOpenApp: true,
      };
      const binder = new PolkadotAppBinder(
        mockedDmk,
        sessionId,
        mockLoggerFactory,
      );
      // ACT
      binder.getAddress(args);
      // ASSERT
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          deviceAction: expect.objectContaining({
            input: {
              command: new GetAddressCommand(args),
              appName: APP_NAME,
              requiredUserInteraction: UserInteractionRequired.None,
              skipOpenApp: true,
            },
          }),
        }),
      );
    });
  });

  describe("signTransaction", () => {
    it("should call executeDeviceAction with SignTransaction interaction", () => {
      // ARRANGE
      const binder = new PolkadotAppBinder(
        mockedDmk,
        sessionId,
        mockLoggerFactory,
      );
      // ACT
      binder.signTransaction({
        derivationPath: "44'/354'/0'/0'/0'",
        blob: new Uint8Array([0x01, 0x02]),
        metadata: new Uint8Array([0x03]),
        skipOpenApp: false,
      });
      // ASSERT
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          deviceAction: expect.objectContaining({
            input: expect.objectContaining({
              appName: APP_NAME,
              requiredUserInteraction: UserInteractionRequired.SignTransaction,
              skipOpenApp: false,
            }),
          }),
        }),
      );
    });

    it("should default skipOpenApp to false when not provided", () => {
      // ARRANGE
      const binder = new PolkadotAppBinder(
        mockedDmk,
        sessionId,
        mockLoggerFactory,
      );
      // ACT
      binder.signTransaction({
        derivationPath: "44'/354'/0'/0'/0'",
        blob: new Uint8Array([0x01]),
        metadata: new Uint8Array([0x02]),
      });
      // ASSERT
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          deviceAction: expect.objectContaining({
            input: expect.objectContaining({
              skipOpenApp: false,
            }),
          }),
        }),
      );
    });
  });
});
