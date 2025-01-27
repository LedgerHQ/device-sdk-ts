import { type TransactionSubset } from "@ledgerhq/context-module";
import { Just, type Maybe, Nothing, Right } from "purify-ts";

import { TransactionMapperService } from "./TransactionMapperService";

const transactionMapperBuilder = (value?: Maybe<TransactionSubset>) => {
  const map = jest.fn().mockReturnValue(value);
  return { map };
};

describe("TransactionMapperService", () => {
  let service: TransactionMapperService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a TransactionSubset", () => {
    // GIVEN
    const mappers = [
      transactionMapperBuilder(Just({ data: "data" } as TransactionSubset)),
      transactionMapperBuilder(Nothing),
    ];
    service = new TransactionMapperService(mappers);

    // WHEN
    const result = service.mapTransactionToSubset(new Uint8Array(0));

    // THEN
    expect(mappers[0]!.map).toHaveBeenCalled();
    expect(mappers[1]!.map).not.toHaveBeenCalled();
    expect(result).toEqual(Right({ data: "data" }));
  });

  it("should return a TransactionSubset for the second mapper", () => {
    // GIVEN
    const mappers = [
      transactionMapperBuilder(Nothing),
      transactionMapperBuilder(Just({ data: "data-2" } as TransactionSubset)),
    ];
    service = new TransactionMapperService(mappers);

    // WHEN
    const result = service.mapTransactionToSubset(new Uint8Array(0));

    // THEN
    expect(mappers[0]!.map).toHaveBeenCalled();
    expect(mappers[1]!.map).toHaveBeenCalled();
    expect(result).toEqual(Right({ data: "data-2" }));
  });

  it("should return an error", () => {
    // GIVEN
    const mappers = [
      transactionMapperBuilder(Nothing),
      transactionMapperBuilder(Nothing),
    ];
    service = new TransactionMapperService(mappers);

    // WHEN
    const result = service.mapTransactionToSubset(new Uint8Array(0));

    // THEN
    expect(mappers[0]!.map).toHaveBeenCalled();
    expect(mappers[1]!.map).toHaveBeenCalled();
    expect(result.isLeft()).toBeTruthy();
  });
});
