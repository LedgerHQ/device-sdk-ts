import {
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from, type Subscription } from "rxjs";

import {
  type GetExtendedDAIntermediateValue,
  type GetExtendedPublicKeyDAError,
  type GetExtendedPublicKeyDAOutput,
} from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import {
  type GetMasterFingerprintDAError,
  type GetMasterFingerprintDAIntermediateValue,
  type GetMasterFingerprintDAOutput,
} from "@api/app-binder/GetMasterFingerprintDeviceActionTypes";
import {
  type RegisterWalletDAError,
  type RegisterWalletDAIntermediateValue,
  type RegisterWalletDAOutput,
} from "@api/app-binder/RegisterWalletDeviceActionTypes";
import {
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
} from "@api/index";
import { type Signature } from "@api/model/Signature";
import { RegisteredWallet, WalletPolicy } from "@api/model/Wallet";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";
import { GetMasterFingerprintCommand } from "@internal/app-binder/command/GetMasterFingerprintCommand";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

import { NullLoggerPublisherService } from "./services/utils/NullLoggerPublisherService";

describe("BtcAppBinder", () => {
  const mockedDmk: DeviceManagementKit = {
    sendCommand: vi.fn(),
    executeDeviceAction: vi.fn(),
  } as unknown as DeviceManagementKit;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    const binder = new BtcAppBinder(
      {} as DeviceManagementKit,
      {} as DeviceSessionId,
      {} as WalletBuilder,
      {} as WalletSerializer,
      {} as DataStoreService,
      {} as PsbtMapper,
      {} as ValueParser,
      NullLoggerPublisherService,
    );
    expect(binder).toBeDefined();
  });

  describe("getExtendedPublicKey", () => {
    let subscription: Subscription;
    afterEach(() => {
      if (subscription) {
        subscription.unsubscribe();
      }
    });
    it("should return the pub key", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const extendedPublicKey =
          "D2PPQSYFe83nDzk96FqGumVU8JA7J8vj2Rhjc2oXzEi5";

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: { extendedPublicKey },
            } as DeviceActionState<
              GetExtendedPublicKeyDAOutput,
              GetExtendedPublicKeyDAError,
              GetExtendedDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new BtcAppBinder(
          mockedDmk,
          "sessionId",
          {} as WalletBuilder,
          {} as WalletSerializer,
          {} as DataStoreService,
          {} as PsbtMapper,
          {} as ValueParser,
          NullLoggerPublisherService,
        );
        const { observable } = appBinder.getExtendedPublicKey({
          derivationPath: "44'/501'",
          checkOnDevice: false,
          skipOpenApp: false,
        });

        // THEN
        const states: DeviceActionState<
          GetExtendedPublicKeyDAOutput,
          GetExtendedPublicKeyDAError,
          GetExtendedDAIntermediateValue
        >[] = [];
        subscription = observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: { extendedPublicKey },
                },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    describe("calls of executeDeviceAction with the correct params", () => {
      const baseParams = {
        derivationPath: "44'/60'/3'/2/1",
        returnChainCode: false,
        skipOpenApp: false,
      };

      it("when checkOnDevice is true: UserInteractionRequired.VerifyAddress", () => {
        // GIVEN
        const checkOnDevice = true;
        const params = {
          ...baseParams,
          checkOnDevice,
        };

        // WHEN
        const appBinder = new BtcAppBinder(
          mockedDmk,
          "sessionId",
          {} as WalletBuilder,
          {} as WalletSerializer,
          {} as DataStoreService,
          {} as PsbtMapper,
          {} as ValueParser,
          NullLoggerPublisherService,
        );
        appBinder.getExtendedPublicKey(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: expect.objectContaining({
            input: {
              command: new GetExtendedPublicKeyCommand(params),
              appName: "Bitcoin",
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
              skipOpenApp: false,
            },
          }),
        });
      });

      it("when checkOnDevice is false: UserInteractionRequired.None", () => {
        // GIVEN
        const checkOnDevice = false;
        const params = {
          ...baseParams,
          checkOnDevice,
        };

        // WHEN
        const appBinder = new BtcAppBinder(
          mockedDmk,
          "sessionId",
          {} as WalletBuilder,
          {} as WalletSerializer,
          {} as DataStoreService,
          {} as PsbtMapper,
          {} as ValueParser,
          NullLoggerPublisherService,
        );
        appBinder.getExtendedPublicKey(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: expect.objectContaining({
            input: {
              command: new GetExtendedPublicKeyCommand(params),
              appName: "Bitcoin",
              requiredUserInteraction: UserInteractionRequired.None,
              skipOpenApp: false,
            },
          }),
        });
      });
    });
  });

  describe("getMasterFingerprint", () => {
    let subscription: Subscription;
    afterEach(() => {
      if (subscription) {
        subscription.unsubscribe();
      }
    });

    it("should return the master fingerprint", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const masterFingerprint = Uint8Array.from([0x82, 0x8d, 0xc2, 0xf3]);

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: { masterFingerprint },
            } as DeviceActionState<
              GetMasterFingerprintDAOutput,
              GetMasterFingerprintDAError,
              GetMasterFingerprintDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new BtcAppBinder(
          mockedDmk,
          "sessionId",
          {} as WalletBuilder,
          {} as WalletSerializer,
          {} as DataStoreService,
          {} as PsbtMapper,
          {} as ValueParser,
          NullLoggerPublisherService,
        );
        const { observable } = appBinder.getMasterFingerprint({
          skipOpenApp: false,
        });

        // THEN
        const states: DeviceActionState<
          GetMasterFingerprintDAOutput,
          GetMasterFingerprintDAError,
          GetMasterFingerprintDAIntermediateValue
        >[] = [];
        subscription = observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: { masterFingerprint },
                },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction with the correct params", () => {
      // GIVEN
      const params = {
        skipOpenApp: false,
      };

      // WHEN
      const appBinder = new BtcAppBinder(
        mockedDmk,
        "sessionId",
        {} as WalletBuilder,
        {} as WalletSerializer,
        {} as DataStoreService,
        {} as PsbtMapper,
        {} as ValueParser,
        NullLoggerPublisherService,
      );
      appBinder.getMasterFingerprint(params);

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
        sessionId: "sessionId",
        deviceAction: expect.objectContaining({
          input: {
            command: new GetMasterFingerprintCommand(),
            appName: "Bitcoin",
            requiredUserInteraction: UserInteractionRequired.None,
            skipOpenApp: false,
          },
        }),
      });
    });

    it("should pass skipOpenApp option correctly", () => {
      // GIVEN
      const params = {
        skipOpenApp: true,
      };

      // WHEN
      const appBinder = new BtcAppBinder(
        mockedDmk,
        "sessionId",
        {} as WalletBuilder,
        {} as WalletSerializer,
        {} as DataStoreService,
        {} as PsbtMapper,
        {} as ValueParser,
        NullLoggerPublisherService,
      );
      appBinder.getMasterFingerprint(params);

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
        sessionId: "sessionId",
        deviceAction: expect.objectContaining({
          input: {
            command: new GetMasterFingerprintCommand(),
            appName: "Bitcoin",
            requiredUserInteraction: UserInteractionRequired.None,
            skipOpenApp: true,
          },
        }),
      });
    });
  });

  describe("signMessage", () => {
    it("should return the signature", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const signature: Signature = {
          r: `0xDEF1`,
          s: `0xAFAF`,
          v: 0,
        };
        const message = "Hello, World!";

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: signature,
            } as DeviceActionState<
              SignMessageDAOutput,
              SignMessageDAError,
              SignMessageDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new BtcAppBinder(
          mockedDmk,
          "sessionId",
          {} as WalletBuilder,
          {} as WalletSerializer,
          {} as DataStoreService,
          {} as PsbtMapper,
          {} as ValueParser,
          NullLoggerPublisherService,
        );
        const { observable } = appBinder.signMessage({
          derivationPath: "44'/60'/3'/2/1",
          message,
          skipOpenApp: false,
        });

        // THEN
        const states: DeviceActionState<
          SignMessageDAOutput,
          SignMessageDAError,
          SignMessageDAIntermediateValue
        >[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: signature,
                },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));
  });

  describe("registerWallet", () => {
    let subscription: Subscription;
    afterEach(() => {
      if (subscription) {
        subscription.unsubscribe();
      }
    });

    it("should return the registered wallet with hmac", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const walletPolicy = new WalletPolicy(
          "My Multisig",
          "wsh(sortedmulti(2,@0/**,@1/**))",
          ["[f5acc2fd/48'/1'/0'/2']tpubXXX", "tpubYYY"],
        );
        const registeredWallet = new RegisteredWallet(
          walletPolicy.name,
          walletPolicy.descriptorTemplate,
          walletPolicy.keys,
          Uint8Array.from(new Array(32).fill(0x42)),
        );

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: registeredWallet,
            } as DeviceActionState<
              RegisterWalletDAOutput,
              RegisterWalletDAError,
              RegisterWalletDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        // WHEN
        const appBinder = new BtcAppBinder(
          mockedDmk,
          "sessionId",
          {} as WalletBuilder,
          {} as WalletSerializer,
          {} as DataStoreService,
          {} as PsbtMapper,
          {} as ValueParser,
          NullLoggerPublisherService,
        );
        const { observable } = appBinder.registerWallet({
          wallet: walletPolicy,
          skipOpenApp: false,
        });

        // THEN
        const states: DeviceActionState<
          RegisterWalletDAOutput,
          RegisterWalletDAError,
          RegisterWalletDAIntermediateValue
        >[] = [];
        subscription = observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: registeredWallet,
                },
              ]);
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should call executeDeviceAction", () => {
      // GIVEN
      const walletPolicy = new WalletPolicy(
        "My Multisig",
        "wsh(sortedmulti(2,@0/**,@1/**))",
        ["[f5acc2fd/48'/1'/0'/2']tpubXXX", "tpubYYY"],
      );

      // WHEN
      const appBinder = new BtcAppBinder(
        mockedDmk,
        "sessionId",
        {} as WalletBuilder,
        {} as WalletSerializer,
        {} as DataStoreService,
        {} as PsbtMapper,
        {} as ValueParser,
        NullLoggerPublisherService,
      );
      appBinder.registerWallet({
        wallet: walletPolicy,
        skipOpenApp: false,
      });

      // THEN
      expect(mockedDmk.executeDeviceAction).toHaveBeenCalled();
    });
  });
});
