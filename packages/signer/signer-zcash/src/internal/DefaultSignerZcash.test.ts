import {
  type DeviceManagementKit,
  type DeviceSessionId,
  DeviceActionStatus,
  type DeviceActionState,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";
import { from } from "rxjs";

import { configTypes } from "./use-cases/config/di/configTypes";
import { addressTypes } from "./use-cases/address/di/addressTypes";
import { transactionTypes } from "./use-cases/transaction/di/transactionTypes";
import { messageTypes } from "./use-cases/message/di/messageTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { DefaultSignerZcash } from "./DefaultSignerZcash";

describe("DefaultSignerZcash", () => {
  let signer: DefaultSignerZcash;
  const mock: Container = {
    get: vi.fn((id: symbol) => ({
      execute: vi.fn(() => {
        if (id === configTypes.GetAppConfigUseCase) {
          return {
            observable: from([
              {
                status: DeviceActionStatus.Completed,
                output: { version: "1.0.0" },
              } as DeviceActionState<any, any, any>,
            ]),
            cancel: vi.fn(),
          } as GetAppConfigDAReturnType;
        } else if (id === addressTypes.GetAddressUseCase) {
          return {
            observable: from([
              {
                status: DeviceActionStatus.Completed,
                output: { address: "zs1test" },
              } as DeviceActionState<any, any, any>,
            ]),
            cancel: vi.fn(),
          } as GetAddressDAReturnType;
        } else if (id === transactionTypes.SignTransactionUseCase) {
          return {
            observable: from([
              {
                status: DeviceActionStatus.Completed,
                output: { signature: new Uint8Array([1, 2, 3]) },
              } as DeviceActionState<any, any, any>,
            ]),
            cancel: vi.fn(),
          } as SignTransactionDAReturnType;
        } else if (id === messageTypes.SignMessageUseCase) {
          return {
            observable: from([
              {
                status: DeviceActionStatus.Completed,
                output: { signature: new Uint8Array([4, 5, 6]) },
              } as DeviceActionState<any, any, any>,
            ]),
            cancel: vi.fn(),
          } as SignMessageDAReturnType;
        }

        return {
          observable: from([]),
          cancel: vi.fn(),
        };
      }),
    })),
  } as unknown as Container;

  beforeEach(() => {
    vi.clearAllMocks();

    const dmk = {} as DeviceManagementKit;
    const sessionId = "" as DeviceSessionId;
    signer = new DefaultSignerZcash({ dmk, sessionId });
    Object.defineProperty(signer, "_container", {
      value: mock as unknown as Container,
      writable: true,
      configurable: true,
    });
  });

  describe("getAppConfig", () => {
    it("should get app config", () =>
      new Promise<void>((resolve, reject) => {
        // WHEN
        const { observable } = signer.getAppConfig();

        // THEN
        expect(mock.get).toHaveBeenCalledWith(
          configTypes.GetAppConfigUseCase,
        );

        const states: DeviceActionState<any, any, any>[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toHaveLength(1);
              const state = states[0];
              expect(state).toBeDefined();
              expect(state?.status).toBe(DeviceActionStatus.Completed);
              if (state?.status === DeviceActionStatus.Completed) {
                expect(state.output).toEqual({ version: "1.0.0" });
              }
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));
  });

  describe("getAddress", () => {
    it("should get an address", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const derivationPath = "m/44'/133'/0'/0/0";

        // WHEN
        const { observable } = signer.getAddress(derivationPath);

        // THEN
        expect(mock.get).toHaveBeenCalledWith(addressTypes.GetAddressUseCase);

        const states: DeviceActionState<any, any, any>[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toHaveLength(1);
              const state = states[0];
              expect(state).toBeDefined();
              expect(state?.status).toBe(DeviceActionStatus.Completed);
              if (state?.status === DeviceActionStatus.Completed) {
                expect(state.output).toEqual({ address: "zs1test" });
              }
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should get an address with options", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const derivationPath = "m/44'/133'/0'/0/0";
        const options = { checkOnDevice: true };

        // WHEN
        const { observable } = signer.getAddress(derivationPath, options);

        // THEN
        expect(mock.get).toHaveBeenCalledWith(addressTypes.GetAddressUseCase);

        const states: DeviceActionState<any, any, any>[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toHaveLength(1);
              const state = states[0];
              expect(state).toBeDefined();
              expect(state?.status).toBe(DeviceActionStatus.Completed);
              if (state?.status === DeviceActionStatus.Completed) {
                expect(state.output).toEqual({ address: "zs1test" });
              }
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));
  });

  describe("signTransaction", () => {
    it("should sign a transaction", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const derivationPath = "m/44'/133'/0'/0/0";
        const transaction = new Uint8Array([1, 2, 3, 4, 5]);

        // WHEN
        const { observable } = signer.signTransaction(derivationPath, transaction);

        // THEN
        expect(mock.get).toHaveBeenCalledWith(
          transactionTypes.SignTransactionUseCase,
        );

        const states: DeviceActionState<any, any, any>[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toHaveLength(1);
              const state = states[0];
              expect(state).toBeDefined();
              expect(state?.status).toBe(DeviceActionStatus.Completed);
              if (state?.status === DeviceActionStatus.Completed) {
                expect(state.output).toEqual({
                  signature: new Uint8Array([1, 2, 3]),
                });
              }
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should sign a transaction with options", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const derivationPath = "m/44'/133'/0'/0/0";
        const transaction = new Uint8Array([1, 2, 3, 4, 5]);
        const options = { skipOpenApp: true };

        // WHEN
        const { observable } = signer.signTransaction(
          derivationPath,
          transaction,
          options,
        );

        // THEN
        expect(mock.get).toHaveBeenCalledWith(
          transactionTypes.SignTransactionUseCase,
        );

        const states: DeviceActionState<any, any, any>[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toHaveLength(1);
              const state = states[0];
              expect(state).toBeDefined();
              expect(state?.status).toBe(DeviceActionStatus.Completed);
              if (state?.status === DeviceActionStatus.Completed) {
                expect(state.output).toEqual({
                  signature: new Uint8Array([1, 2, 3]),
                });
              }
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));
  });

  describe("signMessage", () => {
    it("should sign a message string", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const derivationPath = "m/44'/133'/0'/0/0";
        const message = "Hello, Zcash!";

        // WHEN
        const { observable } = signer.signMessage(derivationPath, message);

        // THEN
        expect(mock.get).toHaveBeenCalledWith(messageTypes.SignMessageUseCase);

        const states: DeviceActionState<any, any, any>[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toHaveLength(1);
              const state = states[0];
              expect(state).toBeDefined();
              expect(state?.status).toBe(DeviceActionStatus.Completed);
              if (state?.status === DeviceActionStatus.Completed) {
                expect(state.output).toEqual({
                  signature: new Uint8Array([4, 5, 6]),
                });
              }
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));

    it("should sign a message Uint8Array", () =>
      new Promise<void>((resolve, reject) => {
        // GIVEN
        const derivationPath = "m/44'/133'/0'/0/0";
        const message = new Uint8Array([10, 20, 30]);

        // WHEN
        const { observable } = signer.signMessage(derivationPath, message);

        // THEN
        expect(mock.get).toHaveBeenCalledWith(messageTypes.SignMessageUseCase);

        const states: DeviceActionState<any, any, any>[] = [];
        observable.subscribe({
          next: (state) => {
            states.push(state);
          },
          error: (err) => {
            reject(err);
          },
          complete: () => {
            try {
              expect(states).toHaveLength(1);
              const state = states[0];
              expect(state).toBeDefined();
              expect(state?.status).toBe(DeviceActionStatus.Completed);
              if (state?.status === DeviceActionStatus.Completed) {
                expect(state.output).toEqual({
                  signature: new Uint8Array([4, 5, 6]),
                });
              }
              resolve();
            } catch (err) {
              reject(err as Error);
            }
          },
        });
      }));
  });
});

