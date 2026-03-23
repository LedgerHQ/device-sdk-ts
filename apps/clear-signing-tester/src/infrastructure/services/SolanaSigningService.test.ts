import { DeviceActionStatus } from "@ledgerhq/device-management-kit";
import { type SignerSolana } from "@ledgerhq/device-signer-kit-solana";
import { Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TypedDataInput } from "@root/src/domain/models/TypedDataInput";

import { SolanaSigningService } from "./SolanaSigningService";

function createMockSigner(overrides: Partial<SignerSolana> = {}): SignerSolana {
  return {
    signTransaction: vi.fn().mockReturnValue({
      observable: new Subject(),
      cancel: vi.fn(),
    }),
    signMessage: vi.fn(),
    getAddress: vi.fn(),
    getAppConfiguration: vi.fn(),
    ...overrides,
  } as unknown as SignerSolana;
}

describe("SolanaSigningService", () => {
  it("should throw when signer is not initialized", () => {
    const service = new SolanaSigningService();
    const input: TransactionInput = {
      kind: SignableInputKind.Transaction,
      rawTx: btoa("fake-tx"),
    };

    expect(() => service.sign(input, "44'/501'/0'")).toThrow(
      "Signer not initialized",
    );
  });

  it("should sign a transaction by converting base64 to Uint8Array", () => {
    const service = new SolanaSigningService();
    const signer = createMockSigner();
    service.setSigner(signer);

    const txBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const base64Tx = btoa(String.fromCharCode(...txBytes));
    const input: TransactionInput = {
      kind: SignableInputKind.Transaction,
      rawTx: base64Tx,
    };

    service.sign(input, "44'/501'/0'");

    expect(signer.signTransaction).toHaveBeenCalledWith(
      "44'/501'/0'",
      expect.any(Uint8Array),
      { skipOpenApp: true },
    );

    const passedBytes = (signer.signTransaction as ReturnType<typeof vi.fn>)
      .mock.calls[0]![1] as Uint8Array;
    expect(Array.from(passedBytes)).toEqual([1, 2, 3, 4, 5]);
  });

  it("should return a SigningServiceResult with an observable", () => {
    const service = new SolanaSigningService();
    const subject = new Subject();
    const signer = createMockSigner({
      signTransaction: vi.fn().mockReturnValue({
        observable: subject.asObservable(),
        cancel: vi.fn(),
      }),
    });
    service.setSigner(signer);

    const input: TransactionInput = {
      kind: SignableInputKind.Transaction,
      rawTx: btoa("tx-data"),
    };

    const result = service.sign(input, "44'/501'/0'");

    expect(result).toBeDefined();
    expect(result.observable).toBeDefined();
  });

  it("should throw for TypedData input", () => {
    const service = new SolanaSigningService();
    const signer = createMockSigner();
    service.setSigner(signer);

    const input: TypedDataInput = {
      kind: SignableInputKind.TypedData,
      data: '{"test": true}',
    };

    expect(() => service.sign(input, "44'/501'/0'")).toThrow(
      "TypedData signing is not supported for Solana",
    );
  });

  it("should throw for invalid base64 input", () => {
    const service = new SolanaSigningService();
    const signer = createMockSigner();
    service.setSigner(signer);

    const input: TransactionInput = {
      kind: SignableInputKind.Transaction,
      rawTx: "!!!not-valid-base64!!!",
    };

    expect(() => service.sign(input, "44'/501'/0'")).toThrow();
  });

  it("should handle empty transaction", () => {
    const service = new SolanaSigningService();
    const signer = createMockSigner();
    service.setSigner(signer);

    const input: TransactionInput = {
      kind: SignableInputKind.Transaction,
      rawTx: btoa(""),
    };

    service.sign(input, "44'/501'/0'");

    expect(signer.signTransaction).toHaveBeenCalledWith(
      "44'/501'/0'",
      expect.any(Uint8Array),
      { skipOpenApp: true },
    );
  });

  it("should propagate the observable from the signer", () => {
    const service = new SolanaSigningService();
    const subject = new Subject<{
      status: DeviceActionStatus;
      intermediateValue: { requiredUserInteraction: unknown };
    }>();
    const signer = createMockSigner({
      signTransaction: vi.fn().mockReturnValue({
        observable: subject.asObservable(),
        cancel: vi.fn(),
      }),
    });
    service.setSigner(signer);

    const input: TransactionInput = {
      kind: SignableInputKind.Transaction,
      rawTx: btoa("tx"),
    };

    const result = service.sign(input, "44'/501'/0'");
    const values: unknown[] = [];
    result.observable.subscribe((v) => values.push(v));

    const pendingState = {
      status: DeviceActionStatus.Pending,
      intermediateValue: { requiredUserInteraction: "SignTransaction" },
    };
    subject.next(pendingState);

    expect(values).toHaveLength(1);
    expect(values[0]).toEqual(pendingState);
  });
});
