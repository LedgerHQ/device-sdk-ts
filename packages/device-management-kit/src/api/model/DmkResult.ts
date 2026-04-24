export enum DmkResultStatus {
  Error = "ERROR",
  Success = "SUCCESS",
}

export type DmkSuccessResult<Data> = {
  status: DmkResultStatus.Success;
  data: Data;
};

export type DmkErrorResult<Error> = {
  status: DmkResultStatus.Error;
  error: Error;
};

export type DmkResult<Data, Error> =
  | DmkSuccessResult<Data>
  | DmkErrorResult<Error>;

type DmkSuccessInput<Data> = {
  data: Data;
};

type DmkErrorInput<Error> = {
  error: Error;
};

type DmkResultInput<Data, Error> = DmkSuccessInput<Data> | DmkErrorInput<Error>;

function isDmkErrorInput<Data, Error>(
  input: DmkResultInput<Data, Error>,
): input is DmkErrorInput<Error> {
  return "error" in input && input.error !== undefined;
}

export function DmkResultFactory<Data, Error>(
  input: DmkResultInput<Data, Error>,
): DmkResult<Data, Error> {
  if (isDmkErrorInput(input)) {
    return {
      status: DmkResultStatus.Error,
      error: input.error,
    };
  }

  return {
    status: DmkResultStatus.Success,
    data: input.data,
  };
}

export function isSuccessDmkResult<Data, Error>(
  result: DmkResult<Data, Error>,
): result is DmkSuccessResult<Data> {
  return result.status === DmkResultStatus.Success;
}
