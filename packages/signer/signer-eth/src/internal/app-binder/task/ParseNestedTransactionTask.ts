import {
  ClearSignContextReferenceType,
  type ClearSignContextSuccess,
  type ClearSignContextType,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import { bufferToHexaString } from "@ledgerhq/device-management-kit";

import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

const DEFAULT_SELECTOR_LENGTH = 10;

export type ParseNestedTransactionTaskResult = {
  readonly subsets: TransactionSubset[];
};

export type ParseNestedTransactionTaskArgs = {
  readonly parser: TransactionParserService;
  readonly subset: TransactionSubset;
  readonly context: ClearSignContextSuccess<ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION>;
};

/**
 * This task is used to construct the nested call data subset list from the transaction subset.
 * It will extract values from the transaction subset using the value path.
 *
 */
export class ParseNestedTransactionTask {
  constructor(private readonly _args: ParseNestedTransactionTaskArgs) {}

  run(): ParseNestedTransactionTaskResult {
    const { parser, subset, context } = this._args;
    const nestedSubsets: TransactionSubset[] = [];

    if (
      !context.reference ||
      context.reference.type !== ClearSignContextReferenceType.CALLDATA ||
      !context.reference.valuePath
    ) {
      throw new Error(
        "Invalid reference for nested call data. Expected a reference with type CALLDATA and a value path.",
      );
    }

    const { valuePath } = context.reference;

    // values and callee are required
    const extractedValues = parser
      .extractValue(subset, valuePath)
      .unsafeCoerce();
    const extractedTo = parser
      .extractValue(subset, context.reference.callee)
      .unsafeCoerce();

    // selector and chainId are optional
    const extractedSelectors = context.reference.selector
      ? parser.extractValue(subset, context.reference.selector).orDefault([])
      : [];
    const extractedChainId = context.reference.chainId
      ? parser.extractValue(subset, context.reference.chainId).orDefault([])
      : [];

    for (let i = 0; i < extractedValues.length; i++) {
      const data = extractedValues[i];
      const chainId = extractedChainId[i];
      const to = extractedTo[i]?.slice(Math.max(0, extractedTo[i]!.length - 20));
      const selector = extractedSelectors[i];

      const nestedSubset: TransactionSubset = {
        data: data ? bufferToHexaString(data) : "0x", // ASK: Should we use 0x or return an error?
        chainId: chainId ? Number(chainId) : subset.chainId,
        to: to ? bufferToHexaString(to) : subset.to,
        selector: selector
          ? bufferToHexaString(selector)
          : data
            ? bufferToHexaString(data).slice(0, DEFAULT_SELECTOR_LENGTH)
            : "0x",
      };

      nestedSubsets.push(nestedSubset);
    }

    return {
      subsets: nestedSubsets,
    };
  }
}
