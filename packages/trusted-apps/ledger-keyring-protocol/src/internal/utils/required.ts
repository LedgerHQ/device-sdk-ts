import { Maybe } from "purify-ts";

import { LKRPMissingDataError } from "@api/app-binder/Errors";

export function required<T>(prop: T | undefined | null, errorMsg: string) {
  return Maybe.fromNullable(prop).toEither(new LKRPMissingDataError(errorMsg));
}
