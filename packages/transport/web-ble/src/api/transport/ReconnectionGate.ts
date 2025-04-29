import { type DmkError } from "@ledgerhq/device-management-kit";
import { type Either, Left, Maybe, Right } from "purify-ts";

export class ReconnectionGate {
  private settle: Maybe<{ resolve(): void; reject(e: DmkError): void }> =
    Maybe.zero();
  wait() {
    return new Promise<Either<DmkError, void>>(
      (r) =>
        (this.settle = Maybe.of({
          resolve: () => r(Right(undefined)),
          reject: (e) => r(Left(e)),
        })),
    );
  }
  resolve() {
    this.settle.ifJust((p) => p.resolve());
    this.settle = Maybe.zero();
  }
  reject(e: DmkError) {
    this.settle.ifJust((p) => p.reject(e));
    this.settle = Maybe.zero();
  }
}
