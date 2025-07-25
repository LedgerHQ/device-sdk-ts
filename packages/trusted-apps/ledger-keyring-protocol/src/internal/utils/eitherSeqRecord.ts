import { Either, EitherAsync, Right } from "purify-ts";

/**
 * Like a lazy version of [Either.sequence](https://gigobyte.github.io/purify/adts/Either#static-sequence) but for records.
 * E.g.:
 * eitherSeqRecord({ a: () => Right(1), b: () => Right("a") }) -> Right({ a: 1, b: "a" })
 * eitherSeqRecord({ a: () => Right(1), b: () => Left("error") }) -> Left("error")
 * It also allows with non-Either values:
 * eitherSeqRecord({ a: () => Right(1), b: "a" }) -> Right({ a: 1, b: "a" })
 */

export function eitherSeqRecord<T extends object>(
  record: T,
): EitherSeqRecord<T> {
  const result: Partial<EitherSeqRecord<T>> = {};
  for (const [key, value] of Object.entries(record) as [string, T[keyof T]][]) {
    const res =
      typeof value === "function" &&
      value.length === 0 &&
      (value as () => unknown)();

    if (!Either.isEither(res)) {
      Object.assign(result, { [key]: value });
    } else if (res.isLeft()) {
      return res as EitherSeqRecord<T>;
    } else {
      Object.assign(result, { [key]: res.extract() });
    }
  }
  return Right(result) as EitherSeqRecord<T>;
}

type EitherSeqRecord<T extends object> = Either<
  UnionOfLeft<T>,
  RecordOfNonLeft<T>
>;

type RecordOfNonLeft<T extends object> = {
  [K in keyof T]: T[K] extends () => Either<unknown, infer R> ? R : T[K];
};

type UnionOfLeft<T extends object> =
  T extends Record<string, infer U>
    ? U extends () => Either<infer L, unknown>
      ? L
      : never
    : never;

/**
 * eitherSeqRecordAsync: like eitherSeqRecord but for EitherAsync.
 * (but not wrapped in a function as EitherAsync are already lazy).
 * E.g.:
 * eitherSeqRecordAsync({ a: EitherAsync<ErrA, 1>, b: EitherAsync<ErrB, "a"> }) -> EitherAsync(ErrA | ErrB, { a: 1, b: "a" }>
 */
export function eitherSeqRecordAsync<T extends object>(
  record: T,
): EitherAsyncSeqRecord<T> {
  return EitherAsync.sequence(
    Object.entries(record).map(([key, value]) =>
      value instanceof EitherAsync
        ? (value as EitherAsync<unknown, unknown>).map((v) => [key, v])
        : EitherAsync.liftEither(Right([key, value])),
    ),
  ).map(Object.fromEntries) as EitherAsyncSeqRecord<T>;
}

type EitherAsyncSeqRecord<T extends object> = EitherAsync<
  UnionOfLeftAsync<T>,
  RecordOfNonLeftAsync<T>
>;

type RecordOfNonLeftAsync<T extends object> = {
  [K in keyof T]: T[K] extends EitherAsync<unknown, infer R> ? R : T[K];
};

type UnionOfLeftAsync<T extends object> =
  T extends Record<string, infer U>
    ? U extends EitherAsync<infer L, unknown>
      ? L
      : never
    : never;
