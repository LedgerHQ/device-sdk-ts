import {
  type ClearSignContext,
  type ClearSignContextType,
} from "@/shared/model/ClearSignContext";

export type ContextLoader<TInput = unknown> = {
  /**
   * @param input - The input to load context for
   * @returns The loaded contexts
   */
  load: (input: TInput) => Promise<ClearSignContext[]>;

  /**
   * @param input - The input to check
   * @param expectedTypes - The expected types of the context to load
   * @returns True if the loader can handle the input, false otherwise
   */
  canHandle: (
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ) => input is TInput;
};
