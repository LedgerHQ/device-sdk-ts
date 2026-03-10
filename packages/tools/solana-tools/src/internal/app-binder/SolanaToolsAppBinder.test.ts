import {
  type DeviceActionState,
  DeviceActionStatus,
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { from } from "rxjs";

import {
  type CraftTransactionDAError,
  type CraftTransactionDAIntermediateValue,
  type CraftTransactionDAOutput,
} from "@api/app-binder/CraftTransactionDeviceActionTypes";
import {
  type GenerateTransactionDAError,
  type GenerateTransactionDAIntermediateValue,
  type GenerateTransactionDAOutput,
} from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { type TransactionFetcherService } from "@internal/services/TransactionFetcherService";

import { SolanaToolsAppBinder } from "./SolanaToolsAppBinder";

describe("SolanaToolsAppBinder", () => {
  const mockedDmk: DeviceManagementKit = {
    executeDeviceAction: vi.fn(),
  } as unknown as DeviceManagementKit;

  const mockTransactionFetcherService: TransactionFetcherService = {
    fetchTransaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    const binder = new SolanaToolsAppBinder(
      {} as DeviceManagementKit,
      "" as DeviceSessionId,
      mockTransactionFetcherService,
    );
    expect(binder).toBeDefined();
  });

  describe("generateTransaction", () => {
    it("should return the generated transaction", () =>
      new Promise<void>((resolve, reject) => {
        const transaction = "base64-generated-tx";

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: transaction,
            } as DeviceActionState<
              GenerateTransactionDAOutput,
              GenerateTransactionDAError,
              GenerateTransactionDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        const appBinder = new SolanaToolsAppBinder(
          mockedDmk,
          "sessionId",
          mockTransactionFetcherService,
        );
        const { observable } = appBinder.generateTransaction({
          derivationPath: "44'/501'/0'/0'",
          skipOpenApp: false,
        });

        const states: DeviceActionState<
          GenerateTransactionDAOutput,
          GenerateTransactionDAError,
          GenerateTransactionDAIntermediateValue
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
                  output: transaction,
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
      const appBinder = new SolanaToolsAppBinder(
        mockedDmk,
        "sessionId",
        mockTransactionFetcherService,
      );
      appBinder.generateTransaction({
        derivationPath: "44'/501'/0'/0'",
        skipOpenApp: false,
      });

      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "sessionId",
          deviceAction: expect.objectContaining({
            input: {
              derivationPath: "44'/501'/0'/0'",
              skipOpenApp: false,
            },
          }),
        }),
      );
    });
  });

  describe("craftTransaction", () => {
    it("should return the crafted transaction", () =>
      new Promise<void>((resolve, reject) => {
        const craftedTx = "base64-crafted-tx";

        vi.spyOn(mockedDmk, "executeDeviceAction").mockReturnValue({
          observable: from([
            {
              status: DeviceActionStatus.Completed,
              output: craftedTx,
            } as DeviceActionState<
              CraftTransactionDAOutput,
              CraftTransactionDAError,
              CraftTransactionDAIntermediateValue
            >,
          ]),
          cancel: vi.fn(),
        });

        const appBinder = new SolanaToolsAppBinder(
          mockedDmk,
          "sessionId",
          mockTransactionFetcherService,
        );
        const { observable } = appBinder.craftTransaction({
          derivationPath: "44'/501'/0'/0'",
          serialisedTransaction: "serialised-tx-input",
        });

        const states: DeviceActionState<
          CraftTransactionDAOutput,
          CraftTransactionDAError,
          CraftTransactionDAIntermediateValue
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
                  output: craftedTx,
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
      const appBinder = new SolanaToolsAppBinder(
        mockedDmk,
        "sessionId",
        mockTransactionFetcherService,
      );
      appBinder.craftTransaction({
        derivationPath: "44'/501'/0'/0'",
        serialisedTransaction: "serialised-tx-input",
      });

      expect(mockedDmk.executeDeviceAction).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "sessionId",
          deviceAction: expect.objectContaining({
            input: expect.objectContaining({
              derivationPath: "44'/501'/0'/0'",
              serialisedTransaction: "serialised-tx-input",
              transactionFetcherService: mockTransactionFetcherService,
            }),
          }),
        }),
      );
    });
  });
});
