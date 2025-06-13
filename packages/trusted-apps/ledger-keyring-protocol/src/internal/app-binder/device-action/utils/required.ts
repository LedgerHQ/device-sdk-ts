import { type Either, Just, Left, Maybe, Right } from "purify-ts";

type RequiredRecord<T extends object> = {
  [K in keyof T]: T[K] extends Maybe<infer U> ? U : T[K];
};

export function requiredToMaybe<
  T extends Record<string, Maybe<unknown> | unknown>,
>(record: T): Maybe<RequiredRecord<T>> {
  const result: Partial<RequiredRecord<T>> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!Maybe.isMaybe(value)) {
      Object.assign(result, { [key]: value });
    } else if (value.isNothing()) {
      return value;
    } else {
      Object.assign(result, { [key]: value.extract() });
    }
  }
  return Just(result) as Maybe<RequiredRecord<T>>;
}

export function requiredToEither<E>(ErrorClass: new (msg: string) => E) {
  return <T extends Record<string, Maybe<unknown> | unknown>>(
    record: T,
  ): Either<E, RequiredRecord<T>> => {
    const result: Partial<RequiredRecord<T>> = {};
    for (const [key, value] of Object.entries(record)) {
      if (!Maybe.isMaybe(value)) {
        Object.assign(result, { [key]: value });
      } else if (value.isNothing()) {
        return Left(new ErrorClass(`${key} is missing`));
      } else {
        Object.assign(result, { [key]: value.extract() });
      }
    }
    return Right(result) as Either<E, RequiredRecord<T>>;
  };
}
