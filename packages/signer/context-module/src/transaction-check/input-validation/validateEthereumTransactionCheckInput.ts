import { isHexaString } from "@ledgerhq/device-management-kit";
import type { Either } from "purify-ts";
import { Left, Right } from "purify-ts";

const PREFIX = "[ContextModule] validateEthereumTransactionCheckInput";

export type ValidatedEthereumTransactionCheckInput = {
  from: string;
  rawTx: string;
  chainId: number;
  domain: string | undefined;
  block: number | undefined;
};

export function validateEthereumTransactionCheckInput(params: {
  from: string;
  rawTx: string;
  chainId: number;
  domain?: string;
  block?: number;
}): Either<Error, ValidatedEthereumTransactionCheckInput> {
  if (!isHexaString(params.from) || params.from === "0x") {
    return Left(new Error(`${PREFIX}: Invalid from address`));
  }
  if (!isHexaString(params.rawTx)) {
    return Left(new Error(`${PREFIX}: Invalid raw transaction hex`));
  }
  if (!Number.isInteger(params.chainId) || params.chainId < 1) {
    return Left(new Error(`${PREFIX}: chainId must be a positive integer`));
  }
  if (params.block !== undefined && !Number.isInteger(params.block)) {
    return Left(new Error(`${PREFIX}: block must be an integer when provided`));
  }

  const domain =
    params.domain !== undefined && params.domain.trim().length > 0
      ? params.domain.trim()
      : undefined;

  return Right({
    from: params.from,
    rawTx: params.rawTx,
    chainId: params.chainId,
    domain,
    block: params.block,
  });
}
