import { type ClearSignContext } from "@/shared/model/ClearSignContext";

export type ContextLoader<TInput = unknown> = {
  /**
   * @param input - The input to load context for
   * @returns The loaded contexts
   */
  load: (input: TInput) => Promise<ClearSignContext[]>;

  /**
   * @param input - The input to check
   * @returns True if the loader can handle the input, false otherwise
   */
  canHandle: (input: unknown) => input is TInput;
};
