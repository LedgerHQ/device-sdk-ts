import {
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
  SendCommandInAppDeviceAction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { from, type Subscription } from "rxjs";

import {
  type GetExtendedDAIntermediateValue,
  type GetExtendedPublicKeyDAError,
  type GetExtendedPublicKeyDAOutput,
} from "@api/app-binder/GetExtendedPublicKeyDeviceActionTypes";
import {
  type SignMessageDAError,
  type SignMessageDAIntermediateValue,
  type SignMessageDAOutput,
} from "@api/index";
import { type Signature } from "@api/model/Signature";
import { BtcAppBinder } from "@internal/app-binder/BtcAppBinder";
import { GetExtendedPublicKeyCommand } from "@internal/app-binder/command/GetExtendedPublicKeyCommand";
import { type DataStoreService } from "@internal/data-store/service/DataStoreService";
import { type PsbtMapper } from "@internal/psbt/service/psbt/PsbtMapper";
import { type ValueParser } from "@internal/psbt/service/value/ValueParser";
import { type WalletBuilder } from "@internal/wallet/service/WalletBuilder";
import { type WalletSerializer } from "@internal/wallet/service/WalletSerializer";

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
      new Promise<Error | void>((done) => {
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
        );
        const { observable } = appBinder.getExtendedPublicKey({
          derivationPath: "44'/501'",
          checkOnDevice: false,
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
            done(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: { extendedPublicKey },
                },
              ]);
              done();
            } catch (err) {
              done(err as Error);
            }
          },
        });
      }));

    describe("calls of executeDeviceAction with the correct params", () => {
      const baseParams = {
        derivationPath: "44'/60'/3'/2/1",
        returnChainCode: false,
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
        );
        appBinder.getExtendedPublicKey(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetExtendedPublicKeyCommand(params),
              appName: "Bitcoin",
              requiredUserInteraction: UserInteractionRequired.VerifyAddress,
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
        );
        appBinder.getExtendedPublicKey(params);

        // THEN
        expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith({
          sessionId: "sessionId",
          deviceAction: new SendCommandInAppDeviceAction({
            input: {
              command: new GetExtendedPublicKeyCommand(params),
              appName: "Bitcoin",
              requiredUserInteraction: UserInteractionRequired.None,
            },
          }),
        });
      });
    });
  });

  describe("signMessage", () => {
    it("should return the signature", () =>
      new Promise<Error | void>((done) => {
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
        );
        const { observable } = appBinder.signMessage({
          derivationPath: "44'/60'/3'/2/1",
          message,
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
            done(err);
          },
          complete: () => {
            try {
              expect(states).toEqual([
                {
                  status: DeviceActionStatus.Completed,
                  output: signature,
                },
              ]);
              done();
            } catch (err) {
              done(err as Error);
            }
          },
        });
      }));
  });
});
